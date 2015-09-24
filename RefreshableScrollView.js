/**
 * @flow weak
 */
'use strict';

let React = require('react-native');
let {
  PropTypes,
  ScrollView,
  StyleSheet,
  View,
} = React;
let ScrollableMixin = require('react-native-scrollable-mixin');
let TimerMixin = require('react-timer-mixin');

let cloneReferencedElement = require('react-native-clone-referenced-element');

let RefreshIndicator = require('./RefreshIndicator');

let RefreshableScrollView = React.createClass({
  mixins: [ScrollableMixin, TimerMixin],

  propTypes: {
    ...ScrollView.propTypes,
    pullToRefreshDistance: PropTypes.number,
    onRefreshStart: PropTypes.func.isRequired,
    renderRefreshIndicator: PropTypes.func.isRequired,
  },

  getDefaultProps() {
    return {
      scrollEventThrottle: 33,
      renderRefreshIndicator: props => <RefreshIndicator {...props} />,
      renderScrollComponent: props => <ScrollView {...props} />,
    };
  },

  getInitialState() {
    return {
      tracking: false,
      trackingAfterBeganRefreshing: false,
      trackingSinceEndedRefreshing: false,
      pullToRefreshProgress: 0,
      refreshing: false,
      refreshIndicatorEnd: null,
    };
  },

  getScrollResponder(): ReactComponent {
    return this._scrollComponent.getScrollResponder();
  },

  setNativeProps(props) {
    this._scrollComponent.setNativeProps(props);
  },

  render() {
    let {
      contentInset,
      renderScrollComponent,
      style,
      ...scrollViewProps,
    } = this.props;

    let refreshIndicatorStyle = {};
    if (this.props.horizontal) {
      if (contentInset && contentInset.left != null) {
        refreshIndicatorStyle.left = contentInset.left;
      } else {
        refreshIndicatorStyle.left = 0;
      }
    } else {
      if (contentInset && contentInset.top != null) {
        refreshIndicatorStyle.top = contentInset.top;
      } else {
        refreshIndicatorStyle.top = 0;
      }
    }

    let isRefreshIndicatorActive =
      this.state.refreshing || this.state.trackingSinceEndedRefreshing;
    if (!isRefreshIndicatorActive && this.state.pullToRefreshProgress <= 0) {
      refreshIndicatorStyle.opacity = 0;
    }

    let refreshIndicator = this.props.renderRefreshIndicator({
      progress: this.state.pullToRefreshProgress,
      active: isRefreshIndicatorActive,
    });

    let scrollComponent = renderScrollComponent({
      ...scrollViewProps,
      contentInset: this._getContentInsetAdjustedForIndicator(),
      onResponderGrant: this._handleResponderGrant,
      onResponderRelease: this._handleResponderRelease,
      onScroll: this._handleScroll,
      style: styles.scrollComponent,
    });
    scrollComponent = cloneReferencedElement(scrollComponent, {
      ref: component => { this._scrollComponent = component; },
    });

    return (
      <View style={[styles.container, style]}>
        <View
          pointerEvents="box-none"
          onLayout={this._handleRefreshIndicatorContainerLayout}
          style={[styles.refreshIndicatorContainer, refreshIndicatorStyle]}>
          {refreshIndicator}
        </View>
        {scrollComponent}
      </View>
    );
  },

  _getContentInsetAdjustedForIndicator() {
    let { contentInset, horizontal } = this.props;
    let { refreshing, tracking, trackingAfterBeganRefreshing } = this.state;

    let shouldAccomodateIndicator =
      refreshing && (!tracking || trackingAfterBeganRefreshing) ||
      !refreshing && trackingAfterBeganRefreshing;
    if (!shouldAccomodateIndicator) {
      return contentInset;
    }

    contentInset = { ...contentInset };
    if (horizontal) {
      contentInset.left = Math.max(
        this.state.refreshIndicatorEnd - this._nativeContentInsetAdjustment.left,
        contentInset.left != null ? contentInset.left : 0
      );
    } else {
      contentInset.top = Math.max(
        this.state.refreshIndicatorEnd - this._nativeContentInsetAdjustment.top,
        contentInset.top != null ? contentInset.top : 0
      );
    }
    return contentInset;
  },

  _handleResponderGrant(event) {
    if (this.props.onResponderGrant) {
      this.props.onResponderGrant(event);
    }
    this.setState(state => ({
      tracking: true,
      trackingAfterBeganRefreshing: state.refreshing,
    }));
  },

  _handleResponderRelease(event) {
    if (this.props.onResponderRelease) {
      this.props.onResponderRelease(event);
    }
    this.setState({
      tracking: false,
      trackingAfterBeganRefreshing: false,
      trackingSinceEndedRefreshing: false,
    });
  },

  _handleScroll(event) {
    if (this.props.onScroll) {
      this.props.onScroll(event);
    }

    let { contentInset, contentOffset } = event.nativeEvent;
    this._nativeContentOffset = contentOffset;
    this._nativeContentInsetAdjustment =
      this._calculateNativeContentInsetAdjustment(contentInset);

    let pullToRefreshProgress = 0;
    if (this.props.pullToRefreshDistance != null ||
        this.state.refreshIndicatorEnd != null) {
      let scrollAxisInset =
        this.props.horizontal ? contentInset.left : contentInset.top;
      let scrollAxisOffset =
        this.props.horizontal ? contentOffset.x : contentOffset.y;
      let pullDistance = -(scrollAxisInset + scrollAxisOffset);
      let pullToRefreshDistance = this.props.pullToRefreshDistance ?
        this.props.pullToRefreshDistance :
        (this.state.refreshIndicatorEnd - scrollAxisInset) * 2;

      if (pullToRefreshDistance > 0) {
        pullToRefreshProgress = pullDistance / pullToRefreshDistance;
        pullToRefreshProgress = Math.max(Math.min(pullToRefreshProgress, 1), 0);
      } else {
        pullToRefreshProgress = 1;
      }
    }

    let wasRefreshing;
    this.setState(state => {
      wasRefreshing = state.refreshing;
      let shouldBeginRefreshing = (pullToRefreshProgress === 1) &&
        state.tracking && !state.trackingSinceEndedRefreshing;
      return {
        pullToRefreshProgress,
        refreshing: state.refreshing || shouldBeginRefreshing,
      };
    }, () => {
      if (!wasRefreshing && this.state.refreshing) {
        this.props.onRefreshStart(this._handleRefreshEnd);
      }
    });
  },

  _calculateNativeContentInsetAdjustment(nativeContentInset) {
    let { contentInset } = this._scrollComponent.props;
    let adjustment = { top: 0, left: 0, bottom: 0, right: 0};
    if (!contentInset) {
      return adjustment;
    }

    for (let side in adjustment) {
      if (contentInset[side] != null) {
        adjustment[side] = nativeContentInset[side] - contentInset[side];
      }
    }
    return adjustment;
  },

  _handleRefreshEnd() {
    if (!this.state.refreshing) {
      return;
    }

    // if (!this.state.tracking) {
    //   let { x, y } = this._nativeContentOffset;
    //   let { horizontal, contentInset } = this.props;
    //   let contentInsetWithIndicator = this._scrollComponent.props.contentInset;
    //   if (horizontal) {
    //     let delta = contentInsetWithIndicator.left - contentInset.left;
    //     this.scrollTo(y, x + delta);
    //   } else {
    //     let delta = contentInsetWithIndicator.top - contentInset.top;
    //     this.scrollTo(y + delta, x);
    //   }
    // }

    this.setState({
      refreshing: false,
      trackingSinceEndedRefreshing: this.state.tracking,
    });
  },

  _handleRefreshIndicatorContainerLayout(event) {
    let { x, y, width, height } = event.nativeEvent.layout;
    let { horizontal} = this.props;
    let end = horizontal ? (x + width) : (y + height);
    this.setState({ refreshIndicatorEnd: end });
  },
});

var styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshIndicatorContainer: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollComponent: {
    backgroundColor: 'transparent',
  },
});

module.exports = RefreshableScrollView;
