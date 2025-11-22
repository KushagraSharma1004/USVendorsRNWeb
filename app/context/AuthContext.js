import { createContext, useState, useEffect, useContext } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { db } from '@/firebase';
import CryptoJS from 'crypto-js';

const SECRET_KEY = 'f3a1d4c7e9b02f4a78e35d9c1406afe3b2c67d8901e2f4a59b3c8e7d6f2a9b0c';

function encryptData(data) {
  const encrypted = CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  return encodeURIComponent(encrypted); // URL safe
}

function decryptData(data) {
  try {
    const decoded = decodeURIComponent(data); // reverse URL encoding
    const bytes = CryptoJS.AES.decrypt(decoded, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('Decryption error:', e);
    return null;
  }
}

export const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const [vendorFullData, setVendorFullData] = useState(null);
  const [vendorMobileNumber, setVendorMobileNumber] = useState('');
  const [vendorPassword, setVendorPassword] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const encryptedMobile = localStorage.getItem('vendorMobileNumber') || '';
      const encryptedPassword = localStorage.getItem('vendorPassword') || '';
      const storedMobileNumber = decryptData(encryptedMobile);
      const storedPassword = decryptData(encryptedPassword);
      if (storedMobileNumber.length === 10 && storedPassword.length > 0) {
        setVendorMobileNumber(storedMobileNumber);
        setVendorPassword(storedPassword);
      }
    }
  }, []);

  // Fetch vendor data when mobile number changes
  const fetchVendorData = async () => {
    try {
      if (vendorMobileNumber.length !== 10) {
        setVendorFullData(null);
        setVendorPassword('');
        return;
      }
      const vendorRef = doc(db, 'users', vendorMobileNumber);
      const vendorDocSnap = await getDoc(vendorRef);

      if (vendorDocSnap.exists()) {
        const vendorData = { ...vendorDocSnap.data(), id: vendorDocSnap.id };
        setVendorFullData(vendorData);

        // If password in DB differs, sync it
        if (vendorPassword !== vendorData.vendorPassword) {
          setVendorPassword(vendorData.vendorPassword);
        }
      } else {
        setVendorFullData(null);
        setVendorPassword('');
        console.log('No such vendor document exists!');
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      setVendorFullData(null);
      setVendorPassword('');
    }
  };

  const logout = () => {
    setVendorMobileNumber('');
    setVendorPassword('');
    localStorage.removeItem('vendorMobileNumber');
    localStorage.removeItem('vendorPassword');
    router.replace('/');
  };

  // When vendorMobileNumber changes, fetch data and address
  useEffect(() => {
    if (vendorMobileNumber.length !== 10) return;
    fetchVendorData();
  }, [vendorMobileNumber]);

  // When mobile number or password changes, sync localStorage and refetch data
  useEffect(() => {
    if (vendorMobileNumber.length !== 10 || vendorPassword.length === 0) return;
    localStorage.setItem('vendorMobileNumber', encryptData(vendorMobileNumber));
    localStorage.setItem('vendorPassword', encryptData(vendorPassword));
  }, [vendorMobileNumber, vendorPassword]);

  const contextValue = {
    vendorMobileNumber,
    setVendorMobileNumber,
    vendorPassword,
    setVendorPassword,
    vendorFullData,
    setVendorFullData,
    logout,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
