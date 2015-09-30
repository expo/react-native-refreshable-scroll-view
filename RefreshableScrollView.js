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

const SCROLL_ANIMATION_DURATION_MS = 350;

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
      pullToRefreshProgress: 0,
      refreshing: false,
      waitingToRest: false,
      returningToTop: false,
      shouldIncreaseContentInset: false,
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
      this.state.refreshing || this.state.waitingToRest;
    if (!isRefreshIndicatorActive && this.state.pullToRefreshProgress <= 0) {
      refreshIndicatorStyle.opacity = 0;
    }

    let refreshIndicator = this.props.renderRefreshIndicator({
      progress: this.state.pullToRefreshProgress,
      active: isRefreshIndicatorActive,
    });

    let scrollComponent = renderScrollComponent({
      pointerEvents: this.state.returningToTop ? 'none' : 'auto',
      ...scrollViewProps,
      contentInset: this._getContentInsetAdjustedForIndicator(),
      onResponderGrant: this._handleResponderGrant,
      onResponderRelease: this._handleResponderRelease,
      onScroll: this._handleScroll,
      onStartShouldSetResponder: (event) => { console.log('onstart'); return false; },
      onScrollShouldSetResponder: (event) => { console.log('onscroll'); return false; },
      onMomentumScrollEnd: this._handleMomentumScrollEnd,
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
    let { shouldIncreaseContentInset } = this.state;

    if (!shouldIncreaseContentInset) {
      console.log('not adjust');
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
    console.log('adjust');
    return contentInset;
  },

  _isOverscrolled() {
    let { x, y } = this._nativeContentOffset;
    let distanceFromTop = this.props.horizontal ?
      x + this._nativeContentInset.left :
      y + this._nativeContentInset.top;
    return distanceFromTop < 0;
  },

  _handleResponderGrant(event) {
    if (this.props.onResponderGrant) {
      this.props.onResponderGrant(event);
    }
    this.setState({ tracking: true });
  },

  _handleResponderRelease(event) {
    if (this.props.onResponderRelease) {
      this.props.onResponderRelease(event);
    }
    this.setState(state => ({
      tracking: false,
      shouldIncreaseContentInset: state.refreshing || state.waitingToRest,
    }));
  },

  _handleScroll(event) {
    if (this.props.onScroll) {
      this.props.onScroll(event);
    }

    let { contentInset, contentOffset } = event.nativeEvent;
    this._nativeContentInset = contentInset;
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
      let { tracking, refreshing, waitingToRest, returningToTop } = state;
      wasRefreshing = refreshing;
      let shouldBeginRefreshing = (pullToRefreshProgress === 1) &&
        tracking && !refreshing && !waitingToRest && !returningToTop;
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

  _handleMomentumScrollEnd(event) {
    if (this.props.onMomentumScrollEnd) {
      this.props.onMomentumScrollEnd(event);
    }
    if (this.state.waitingToRest) {
      this._restoreScrollView();
    }
  },

  _handleRefreshEnd() {
    if (!this.state.refreshing) {
      return;
    }

    // Let the scroll view naturally bounce back to its resting position before
    // hiding the loading indicator if it is still pulled down or the user is
    // touching it
    let waitingToRest = this.state.tracking || this._isOverscrolled();
    this.setState({
      refreshing: false,
      waitingToRest,
    });

    if (!waitingToRest) {
      this._restoreScrollView();
    }
  },

  _restoreScrollView() {
    // Scroll up to the top to restore the scrollable content's position
    let scrollDestination = null;
    let { x, y } = this._nativeContentOffset;
    let { horizontal, contentInset } = this.props;
    let contentInsetWithIndicator = this._scrollComponent.props.contentInset;
    if (horizontal) {
      let indicatorWidth = contentInsetWithIndicator.left - contentInset.left;
      let scrolledDistance = this._nativeContentInset.left + x;
      if (indicatorWidth > 0 && indicatorWidth > scrolledDistance) {
        let destinationX = Math.min(x, -this._nativeContentInset.left) + indicatorWidth;
        scrollDestination = [y, destinationX];
      }
    } else {
      let indicatorHeight = contentInsetWithIndicator.top - contentInset.top;
      let scrolledDistance = this._nativeContentInset.top + y;
      if (indicatorHeight > 0 && indicatorHeight > scrolledDistance) {
        let destinationY = Math.min(y, -this._nativeContentInset.top) + indicatorHeight;
        scrollDestination = [destinationY, x];
      }
    }

    this.setState({
      refreshing: false,
      waitingToRest: false,
      returningToTop: !!scrollDestination,
      shouldIncreaseContentInset: false,
    }, () => {
      if (scrollDestination) {
        this.scrollTo(...scrollDestination);
        // We detect whether the scrolling has finished based on the scroll
        // position, but we must eventually set returningToTop to false since
        // we block user interactions while it is true
        this.clearTimeout(this._returningToTopSafetyTimeout);
        this._returningToTopSafetyTimeout = this.setTimeout(() => {
          this._returningToTopSafetyTimeout = null;
          this.setState({ returningToTop: false });
        }, SCROLL_ANIMATION_DURATION_MS);
      }
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
