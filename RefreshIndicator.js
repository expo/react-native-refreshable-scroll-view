/**
 * @flow weak
 */
'use strict';

var React = require('react-native');
var {
  ActivityIndicatorIOS,
  PropTypes,
  StyleSheet,
} = React;

/**
 * A default refresh indicator. This component will likely change so copy and
 * paste this code if you rely on it.
 */
class RefreshIndicator extends React.Component {

  static propTypes = {
    progress: PropTypes.number,
    active: PropTypes.bool,
  };

  render() {
    let animatedStyle = {
      opacity: this.props.progress,
    };
    return (
      <ActivityIndicatorIOS
        animating={this.props.active}
        style={[styles.container, animatedStyle, this.props.style]}
      />
    );
  }
}

let styles = StyleSheet.create({
  container: {
    margin: 12,
  },
});

module.exports = RefreshIndicator;
