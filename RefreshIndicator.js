/**
 * @flow weak
 */
'use strict';

import React, {
  ActivityIndicatorIOS,
  PropTypes,
  StyleSheet,
} from 'react-native';

/**
 * A default refresh indicator. This component will likely change so copy and
 * paste this code if you rely on it.
 */
class RefreshIndicator extends React.Component {

  static propTypes = {
    progress: PropTypes.number.isRequired,
    active: PropTypes.bool.isRequired,
  };

  shouldComponentUpdate(nextProps) {
    let { progress, active } = this.props;
    return (progress !== nextProps.progress) || (active !== nextProps.active);
  }

  render() {
    let { progress, active } = this.props;
    let animatedStyle = {
      transform: [
        { rotate: `${progress * 2 * Math.PI}rad` },
      ],
    };
    return (
      <ActivityIndicatorIOS
        animating={active}
        hidesWhenStopped={progress === 0}
        style={[styles.container, animatedStyle]}
      />
    );
  }
}

let styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
});

module.exports = RefreshIndicator;
