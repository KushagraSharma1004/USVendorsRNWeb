import { View, Image } from 'react-native'
import { Tabs } from 'expo-router'

const TabsLayout = () => {

    return (
        <View className={`flex-1`}>
            <Tabs
                initialRouteName="Home"
                screenOptions={{
                    animation: 'shift',
                    headerShown: false,
                    tabBarActiveBackgroundColor: '#2874F0',
                    tabBarActiveTintColor: 'white',
                    tabBarStyle: {
                        borderTopLeftRadius: 10,
                        borderTopRightRadius: 10,
                        borderTopWidth: 5,
                        borderColor: '#2874F0',
                        height: 65,
                        paddingTop: 3,
                        paddingBottom: 3
                    },
                    tabBarItemStyle: {
                        borderRadius: 10,
                        marginHorizontal: 5,
                        overflow: 'hidden',
                    },
                    tabBarLabelStyle: {
                        marginTop: 3,
                    },
                }}
            >
                <Tabs.Screen
                    name='Home'
                    options={{
                        tabBarIcon: ({ focused }) => <Image style={{ height: 35, width: 35, tintColor: focused ? 'white' : '' }} source={require('../../assets/images/homeImage.png')} />,
                    }}
                />
            </Tabs>
        </View>
    )
}

export default TabsLayout;