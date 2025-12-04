import React, { useEffect } from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  Text,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const Switch = ({
  value,
  onPress,
  style,
  duration = 400,
  trackColors = { on: '#82cab2', off: '#fa7f7c' },
  thumbColor = 'white',
  activeText = 'ON',
  inactiveText = 'OFF',
  textFontSize = 14,
  textColor = 'white',
  thumbRadius = 'thumbSize / 2'
}) => {
  const height = useSharedValue(0); // Actual height of the track (from onLayout)
  const width = useSharedValue(0);  // Actual width of the track (from onLayout)

  // This SharedValue will drive animations based on the boolean `value` prop
  const animatedProgress = useSharedValue(value ? 1 : 0);

  // Crucial: Update the animatedProgress whenever the boolean `value` prop changes
  useEffect(() => {
    animatedProgress.value = withTiming(value ? 1 : 0, { duration });
  }, [value, animatedProgress, duration]);


  // Animated style for the track's background color
  const trackBackgroundAnimatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      animatedProgress.value,
      [0, 1],
      [trackColors.off, trackColors.on]
    );
    return {
      backgroundColor: color,
    };
  });

  // Determine actual padding from style prop or default
  // This needs to be robust to handle cases where 'padding' might not be explicitly set in style
  const actualPadding = (style && typeof style.padding === 'number') ? style.padding : switchStyles.track.padding;


  // FIX IS PRIMARILY HERE
  const thumbAnimatedStyle = useAnimatedStyle(() => {
    // Calculate the size of the thumb based on the track's height and padding.
    // The thumb should fill the vertical space available after accounting for top/bottom padding.
    const thumbSize = height.value - (2 * actualPadding);

    // Calculate the start position (left edge of the thumb when OFF)
    const moveStart = actualPadding;

    // Calculate the end position (left edge of the thumb when ON)
    // This is: total track width - thumb's own size - right padding
    const moveEnd = width.value - thumbSize - actualPadding;

    // Interpolate the translateX property for the thumb
    const translateX = interpolate(
      animatedProgress.value, // Input is the animation progress (0 to 1)
      [0, 1.2],                   // When progress is 0, thumb is at moveStart; when 1, at moveEnd
      [moveStart, moveEnd]
    );

    return {
      transform: [{ translateX: translateX }],
      width: thumbSize,        // Set the actual calculated width
      height: thumbSize,       // Set the actual calculated height
      borderRadius: thumbRadius === 'thumbSize / 2' ? thumbSize / 2 : thumbRadius, // Make it perfectly circular
      backgroundColor: thumbColor,
    };
  });


  const inactiveTextAnimatedStyle = useAnimatedStyle(() => {
    // Fade out text when progress goes from 0 to 0.5
    const opacity = interpolate(animatedProgress.value, [0, 0.5, 1], [1, 0, 0]);
    return { opacity: opacity };
  });

  const activeTextAnimatedStyle = useAnimatedStyle(() => {
    // Fade in text when progress goes from 0.5 to 1
    const opacity = interpolate(animatedProgress.value, [0, 0.5, 1], [0, 0, 1]);
    return { opacity: opacity };
  });

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        onLayout={(e) => {
          // Capture the actual rendered height and width of the track
          height.value = e.nativeEvent.layout.height;
          width.value = e.nativeEvent.layout.width;
        }}
        // Apply base styles, any custom styles from props, and the animated background color
        style={[switchStyles.track, style, trackBackgroundAnimatedStyle]}
      >
        {/* Inactive Text (e.g., "OFF") - positioned on the LEFT */}
        {/* FIX: Ensure `position: 'absolute'` is correctly applied within `switchStyles.textContainer` */}
        <Animated.View
          style={[
            // Removed redundant 'position: absolute' from inline style, relying on switchStyles.textContainer
            switchStyles.textContainer,
            { right: actualPadding + 3, left: 'auto' }, // Explicitly set right to 'auto' for left positioning
            inactiveTextAnimatedStyle,
          ]}
        >
          <Text style={[switchStyles.text, { fontSize: textFontSize, color: textColor }]}>
            {inactiveText}
          </Text>
        </Animated.View>

        {/* Active Text (e.g., "ON") - positioned on the RIGHT */}
        {/* FIX: Ensure `position: 'absolute'` is correctly applied within `switchStyles.textContainer` */}
        <Animated.View
          style={[
            // Removed redundant 'position: absolute' from inline style, relying on switchStyles.textContainer
            switchStyles.textContainer,
            { left: actualPadding + 3, right: 'auto' }, // Explicitly set left to 'auto' for right positioning
            activeTextAnimatedStyle,
          ]}
        >
          <Text style={[switchStyles.text, { fontSize: textFontSize, color: textColor }]}>
            {activeText}
          </Text>
        </Animated.View>

        {/* Single Thumb */}
        <Animated.View
          style={[switchStyles.thumb, thumbAnimatedStyle]}
        />
      </Animated.View>
    </Pressable>
  );
};

const switchStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100, // Default width
    height: 40, // Default height
    padding: 3, // Default padding inside the track
    overflow: 'hidden', // Crucial for clipping the thumb and text if they exceed bounds
    position: 'relative', // Necessary for absolute positioning of thumb and text
    borderRadius: 20, // Default rounded corners for the track (can be overridden by `style` prop)
  },
  thumb: {
    position: 'absolute', // Allows it to slide freely within the track
    // width, height, borderRadius, and backgroundColor are set by thumbAnimatedStyle
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4, // Android shadow
  },
  textContainer: {
    position: 'absolute', // Allows independent positioning
    height: '100%', // Take full height for vertical centering of text
    justifyContent: 'center', // Vertically center the text
    alignItems: 'center', // Horizontally center text within its small container
    // 'left'/'right' properties are set in the animated style
  },
  text: {
    fontWeight: 'bold',
  },
});

export default function ToggleButton({activeText, inactiveText, textFontSize, textColor, onPress, value, onColor, offColor, thumbColor, switchStyle, className, duration, thumbRadius} ) {
  const isBusinessActive = useSharedValue(false); // Changed to a meaningful name
    const valueFromProp = value
  const handleToggle = () => {
    isBusinessActive.value = !isBusinessActive.value;
    console.log('Switch Toggled:', isBusinessActive.value);
  };

  return (
    <View className={className} style={styles.container}>
      <Switch
        value={valueFromProp === undefined ? isBusinessActive : valueFromProp} // Pass the SharedValue directly
        onPress={onPress || handleToggle}
        style={switchStyle !== undefined ? switchStyle : styles.customSwitchSize}
        trackColors={{ on: onColor || '#4CAF50', off: offColor || '#F44336' }} // Green for ON, Red for OFF
        thumbColor={thumbColor || 'white'}
        activeText={activeText}
        inactiveText={inactiveText}
        textFontSize={textFontSize} // Custom font size for text
        textColor={textColor} // Text color
        duration={duration}
        thumbRadius={thumbRadius}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  customSwitchSize: {
    width: 58, // Example: Larger width
    height: 25, // Example: Larger height
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});