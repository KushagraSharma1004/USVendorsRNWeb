import { View, Text, StyleSheet } from 'react-native';
import TouchableOpacityComponent from './TouchableOpacity';
import { useAuth } from '../context/AuthContext';

const SubMenuModal = ({ isVisible, onClose }) => {
    const { logout } = useAuth();

    return (
        <View className='h-full' style={{ display: isVisible ? 'flex' : 'none', zIndex: 9999999 }}>
            <TouchableOpacityComponent className={''} style={styles.overlay} activeOpacity={1} onPress={onClose} innerMaterial={
                <View style={styles.menuContainer}>
                    <Text style={styles.menuTitle}>More Options</Text>
                    <TouchableOpacityComponent className={''} style={styles.menuItem} onPress={logout} innerMaterial={<Text style={styles.logoutText}>Logout</Text>} />
                </View>
            } />
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end', // Position the menu at the bottom, above the tab bar
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)', // Dim the background
        zIndex: 9999999
    },
    menuContainer: {
        width: '90%', // 90% of screen width
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        marginBottom: 20, // Adjust this to sit just above your tab bar
        alignItems: 'center',
        elevation: 5, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 9999999
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
        zIndex: 9999999
    },
    menuItem: {
        width: '100%',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
        zIndex: 9999999
    },
    menuItemText: {
        fontSize: 16,
        color: '#2874F0', // Or your primary color
        fontWeight: '600',
        zIndex: 9999999,
        textAlign: 'center'
    },
    logoutText: {
        fontSize: 16,
        color: 'red', // Or your primary color
        fontWeight: '600',
        zIndex: 9999999
    }
});

export default SubMenuModal;