jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = React.forwardRef((props: any, ref: any) =>
    React.createElement(Text, { ...props, ref }),
  );
  Icon.displayName = "MockIcon";
  return {
    Ionicons: Icon,
    MaterialIcons: Icon,
    MaterialCommunityIcons: Icon,
    Feather: Icon,
    FontAwesome: Icon,
    FontAwesome5: Icon,
    FontAwesome6: Icon,
    AntDesign: Icon,
    Entypo: Icon,
    EvilIcons: Icon,
    Foundation: Icon,
    Octicons: Icon,
    SimpleLineIcons: Icon,
    Zocial: Icon,
  };
});
