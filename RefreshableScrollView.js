/**
 * Copyright 2015-present 650 Industries. All rights reserved.
 *
 * @providesModule RefreshableScrollView
 * @flow weak
 */
'use strict';

var React = require('react-native');
var ScrollableMixin = require('react-native-scrollable-mixin');
var TimerMixin = require('react-timer-mixin');
var {
  NativeModules: {
    UIManager,
  },
  PropTypes,
  ScrollView,
  StyleSheet,
  View,
} = React;

var SCROLL_VIEW_REF = 'scrollView';
var REFRESH_INDICATOR_REF = 'refreshIndicator';

var RefreshableScrollView = React.createClass({
  mixins: [ScrollableMixin, TimerMixin],

  propTypes: {
    ...ScrollView.propTypes,
    scrollComponentClass: PropTypes.func,
    refreshIndicator: PropTypes.node.isRequired,
    pullToRefreshDistance: PropTypes.number,
    onRefreshStart: PropTypes.func.isRequired,
  },

  getDefaultProps() {
    return {
      scrollViewClass: ScrollView,
      scrollEventThrottle: 33,
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
    return this.refs[SCROLL_VIEW_REF].getScrollResponder();
  },

  setNativeProps(props) {
    this.refs[SCROLL_VIEW_REF].setNativeProps(props);
  },

  render() {
    var refreshIndicator = React.cloneElement(this.props.refreshIndicator, {
      ref: REFRESH_INDICATOR_REF,
      progress: this.state.pullToRefreshProgress,
      active: this.state.refreshing,
    });

    var {style, contentInset, ...scrollViewProps} = this.props;
    if (this.state.refreshing && (!this.state.tracking || this.state.trackingAfterRefreshing) ||
        !this.state.refreshing && this.state.trackingAfterRefreshing) {
      contentInset = {...contentInset};
      if (this.props.horizontal) {
        contentInset.left = Math.max(this.state.refreshIndicatorEnd, contentInset.left);
      } else {
        contentInset.top = Math.max(this.state.refreshIndicatorEnd, contentInset.top);
      }
    }

    var ScrollComponent = this.props.scrollComponentClass;
    return (
      <View style={style}>
        <View pointerEvents="box-none" style={styles.refreshIndicatorContainer}>
          {refreshIndicator}
        </View>
        <ScrollComponent
          {...scrollViewProps}
          ref={SCROLL_VIEW_REF}
          contentInset={contentInset}
          automaticallyAdjustContentInsets={false}
          onResponderGrant={this._handleResponderGrant}
          onResponderRelease={this._handleResponderRelease}
          onScroll={this._handleScroll}
          style={styles.scrollView}>
          {this.props.children}
        </ScrollComponent>
      </View>
    );
  },

  componentDidMount() {
    this.requestAnimationFrame(this._measureRefreshIndicator);
  },

  _handleResponderGrant(event) {
    if (this.props.onResponderGrant) {
      this.props.onResponderGrant(event);
    }
    this.setState((state) => ({
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

    var pullToRefreshProgress = 0;
    if (this.props.pullToRefreshDistance != null ||
        this.state.refreshIndicatorEnd != null) {
      var {contentInset, contentOffset} = event.nativeEvent;
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

    var beginRefreshing = !this.state.refreshing && (pullToRefreshProgress === 1);
    this.setState((state) => ({
      pullToRefreshProgress,
      refreshing: state.refreshing || (pullToRefreshProgress === 1),
    }));
    if (beginRefreshing) {
      this.props.onRefreshStart(this._handleRefreshEnd);
    }
  },

  _handleRefreshEnd() {
    if (this.state.refreshing) {
      this.setState({refreshing: false});
      // This isn't right; we want to scroll by the delta of the content inset
      this.scrollTo(-64, 0);
    }
  },

  _measureRefreshIndicator() {
    // TODO: use onLayout
    UIManager.measureLayoutRelativeToParent(
      React.findNodeHandle(this.refs[REFRESH_INDICATOR_REF]),
      (error) => console.error('Error measuring refresh indicator: ' + error.message),
      (left, top, width, height) => {
        var end = this.props.horizontal ? (left + width) : (top + height);
        this.setState({refreshIndicatorEnd: end});
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
  scrollView: {
    backgroundColor: 'transparent',
  }
});

module.exports = RefreshableScrollView;
