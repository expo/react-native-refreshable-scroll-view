/**
 * @flow weak
 */
'use strict';

var React = require('react-native');
var {
  PropTypes,
  Text,
  View,
} = React;

var RefreshIndicator = React.createClass({

  propTypes: {
    progress: PropTypes.number,
    active: PropTypes.bool,
  },

  render() {
    // The world's most boring scroll indicator
    var backgroundColor = this.props.active ? '#f93d3c' : '#ccc';
    return <View style={[
        {width: 40, height: 40, overflow: 'hidden', backgroundColor, borderRadius: 10, opacity: this.props.progress},
        this.props.style]}>
      </View>
  },
});

module.exports = RefreshIndicator;
