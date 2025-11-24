import { View, Text, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from './context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { decryptData, encryptData } from './context/hashing';

const Index = () => {
  const { setVendorFullData, setVendorMobileNumber, setVendorPassword } = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const params = useLocalSearchParams();
  const oldMethod_FromQR = params.fromQR === 'true' ? true : false
  const oldMethod_VendorMobileNumberFromQR = params.vendorMobileNumberFromQR || ''
  const [isChecked, setIsChecked] = useState(false)

  useEffect(() => {
    // Mark router as ready after initial mount
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (oldMethod_FromQR && oldMethod_VendorMobileNumberFromQR.length === 10) {
      router.replace(`/Vendors/?vendor=${encodeURIComponent(encryptData(oldMethod_VendorMobileNumberFromQR))}&fromQR=true`)
      return
    }
    setIsChecked(true)
  }, [oldMethod_FromQR, oldMethod_VendorMobileNumberFromQR, isReady])

  useEffect(() => {
    const redirect = async () => {
      if (!isReady) return; // Only redirect when router is ready
      if (!isChecked) return
      try {
        // if(oldMethod_FromQR && oldMethod_VendorMobileNumberFromQR.length === 10){
        //   router.replace(`/Vendors/?vendor=${encodeURIComponent(oldMethod_VendorMobileNumberFromQR)}&fromQR=true`)
        //   return
        // }
        const vendorMobileNumber = typeof window !== "undefined" ? decryptData(localStorage.getItem('vendorMobileNumber')) || '' : '';
        const vendorPassword = typeof window !== "undefined" ? decryptData(localStorage.getItem('vendorPassword')) || '' : '';

        if (vendorMobileNumber.length === 10 && vendorPassword.length > 0) {
          const vendorRef = doc(db, 'users', vendorMobileNumber);
          const vendorDocRef = await getDoc(vendorRef);
          if (vendorDocRef.exists()) {
            const dbPassword = vendorDocRef.data().vendorPassword;
            if (vendorPassword === dbPassword) {
              await setVendorFullData(vendorDocRef.data());
              await setVendorMobileNumber(vendorMobileNumber);
              await setVendorPassword(vendorPassword);
              router.replace('/(tabs)/Home');
              return;
            }
          }
        }
        router.replace('/Login');
      } catch (error) {
        router.replace('/Login');
      }
    };
    redirect();
  }, [isReady, router, setVendorFullData, setVendorMobileNumber, setVendorPassword, isChecked]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2874F0' }}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={{ color: 'white', marginTop: 10 }}>Loading...</Text>
    </View>
  );
};

export default Index;
