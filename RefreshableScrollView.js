/**
 * @flow weak
 */
'use strict';

let React = require('react-native');
let {
  NativeModules: {
    UIManager,
  },
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
      renderRefreshIndicator: () => <RefreshIndicator />,
      renderScrollComponent: props => <ScrollView {...props} />,
    };
  },

  getInitialState() {
    return {
      tracking: false,
      trackingAfterRefreshing: false,
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
    let { style, contentInset, ...scrollViewProps } = this.props;
    if (this.state.refreshing && (!this.state.tracking || this.state.trackingAfterRefreshing) ||
        !this.state.refreshing && this.state.trackingAfterRefreshing) {
      contentInset = { ...contentInset };
      if (this.props.horizontal) {
        contentInset.left = Math.max(this.state.refreshIndicatorEnd, contentInset.left);
      } else {
        contentInset.top = Math.max(this.state.refreshIndicatorEnd, contentInset.top);
      }
    }

    let scrollComponent = this.props.renderScrollComponent({
      ...scrollViewProps,
      contentInset,
      automaticallyAdjustContentInsets: false,
      onResponderGrant: this._handleResponderGrant,
      onResponderRelease: this._handleResponderRelease,
      onScroll: this._handleScroll,
      style: styles.scrollComponent,
    });
    scrollComponent = cloneReferencedElement(scrollComponent, {
      ref: component => { this._scrollComponent = component; },
    });

    return (
      <View style={style}>
        <View pointerEvents="box-none" style={styles.refreshIndicatorContainer}>
          {this._renderRefreshIndicator()}
        </View>
        {scrollComponent}
      </View>
    );
  },

  _renderRefreshIndicator() {
    let refreshIndicator = this.props.renderRefreshIndicator({
      progress: this.state.pullToRefreshProgress,
      active: this.state.refreshing,
    });
    return cloneReferencedElement(refreshIndicator, {
      ref: component => { this._refreshIndicator = component; },
    });
  },

  componentDidMount() {
    this.requestAnimationFrame(this._measureRefreshIndicator);
  },

  _handleResponderGrant(event) {
    if (this.props.onResponderGrant) {
      this.props.onResponderGrant(event);
    }
    this.setState(state => ({
      tracking: true,
      trackingAfterRefreshing: state.refreshing,
    }));
  },

  _handleResponderRelease(event) {
    if (this.props.onResponderRelease) {
      this.props.onResponderRelease(event);
    }
    this.setState({
      tracking: false,
      trackingAfterRefreshing: false,
    });
  },

  _handleScroll(event) {
    if (this.props.onScroll) {
      this.props.onScroll(event);
    }

    this._nativeContentInset = event.nativeEvent.nativeContentInset;
    if (!this.state.tracking) {
      return;
    }

    let pullToRefreshProgress = 0;
    if (this.props.pullToRefreshDistance != null ||
        this.state.refreshIndicatorEnd != null) {
      var { contentInset, contentOffset } = event.nativeEvent;
      var scrollAxisInset =
        this.props.horizontal ? contentInset.left : contentInset.top;
      var scrollAxisOffset =
        this.props.horizontal ? contentOffset.x : contentOffset.y;
      var pullDistance = -(scrollAxisInset + scrollAxisOffset);
      var pullToRefreshDistance = this.props.pullToRefreshDistance ?
        this.props.pullToRefreshDistance :
        (this.state.refreshIndicatorEnd - scrollAxisInset) * 2;

      if (pullToRefreshDistance > 0) {
        pullToRefreshProgress = pullDistance / pullToRefreshDistance;
        pullToRefreshProgress = Math.max(Math.min(pullToRefreshProgress, 1), 0);
      } else {
        pullToRefreshProgress = 1;
      }
    }

    let beginRefreshing = !this.state.refreshing && (pullToRefreshProgress === 1);
    this.setState(state => ({
      pullToRefreshProgress,
      refreshing: state.refreshing || (pullToRefreshProgress === 1),
    }));
    if (beginRefreshing) {
      this.props.onRefreshStart(this._handleRefreshEnd);
    }
  },

  _handleRefreshEnd() {
    if (this.state.refreshing) {
      this.setState({ refreshing: false });
      // This isn't right; we want to scroll by the delta of the content inset
      this.scrollTo(-64, 0);
    }
  },

  _measureRefreshIndicator() {
    // TODO: use onLayout, but the refresh indicator needs to support onLayout
    UIManager.measureLayoutRelativeToParent(
      React.findNodeHandle(this._refreshIndicator),
      error => console.error('Error measuring refresh indicator: ' + error.message),
      (left, top, width, height) => {
        let end = this.props.horizontal ? (left + width) : (top + height);
        this.setState({ refreshIndicatorEnd: end });
      }
    );
  },
});

var styles = StyleSheet.create({
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
  }
});

module.exports = RefreshableScrollView;
