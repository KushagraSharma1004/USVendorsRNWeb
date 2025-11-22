import { Alert, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import TextInputComponent from './components/TextInput'
import { auth, db } from '../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import Loader from './components/Loader'
import { useRouter } from 'expo-router'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const ForgotPassword = () => {
  const router = useRouter()
  const [vendorMobileNumber, setVendorMobileNumber] = useState('')
  const [confirmationResult, setConfirmationResult] = useState(null)
  const [isCommonLoaderVisible, setIsCommonLoaderVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [otp, setOtp] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isVendorAllowedToSetNewPassword, setIsVendorAllowedToSetNewPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
          callback: () => console.log("Recaptcha solved."),
        }
      );
      window.recaptchaVerifier.render();
    }
  };

  const handleSendOTP = async () => {
    setIsCommonLoaderVisible(true)
    try {
      if (vendorMobileNumber.length !== 10) {
        setErrorMessage('Please enter a valid 10 digit mobile number.')
        return;
      }

      const vendorRef = doc(db, 'users', vendorMobileNumber);
      const vendorDoc = await getDoc(vendorRef);

      if (!vendorDoc.exists()) {
        setErrorMessage(`'${vendorMobileNumber}' is not registered.`)
        return;
      }

      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, `+91${vendorMobileNumber}`, appVerifier);
      setConfirmationResult(confirmation);

      setIsCommonLoaderVisible(false)

    } catch (error) {
      console.error('Error sending OTP:', error);
      setErrorMessage(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsCommonLoaderVisible(false)
    }
  }

  const confirmCode = async () => {
    if (!otp || otp.length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP');
      return;
    }

    if (!confirmationResult) {
      setErrorMessage('No OTP has been sent – request one first.');
      return;
    }

    
    try {
      setIsCommonLoaderVisible(true)
      await confirmationResult.confirm(otp);
      setIsVendorAllowedToSetNewPassword(true)
      setSuccessMessage('✅ Phone verified! Registration complete.');
      setErrorMessage('')
      setConfirmationResult(null);
    } catch (error) {
      console.log('Invalid code.', error);
      setErrorMessage('Invalid OTP – please try again.');
    } finally {
      setIsCommonLoaderVisible(false)
    }
  };

  const handleChangePassword = async () => {
    try{
      setIsCommonLoaderVisible(true)
    const vendorRef = doc(db, 'users', vendorMobileNumber)

    updateDoc(vendorRef, {
      vendorPassword: newPassword
    })
    router.replace(`/Login/?vendorMobileNumber=${vendorMobileNumber}&vendorPassword=${newPassword}`)
    setVendorMobileNumber('')
    setIsVendorAllowedToSetNewPassword(false)
    setNewPassword('')
    setIsCommonLoaderVisible(false)
  } catch (error) {
    console.log('Error changing password: ', error)
    setErrorMessage('Error changing password. Please try again.')
  } finally {
    setIsCommonLoaderVisible(false)
  }
  }

  return (
    <View className='flex flex-1 bg-primary items-center justify-center gap-2' >
      <View id="recaptcha-container" style={{ zIndex: 10 }} />
      {isCommonLoaderVisible && <Loader></Loader>}
      <Text className='text-white text-2xl font-bold text-center'>Reset Password</Text>
      {!confirmationResult && isVendorAllowedToSetNewPassword === false &&
        <View className='bg-white rounded-[10px] p-5 w-[93%] max-w-md items-center justify-center gap-[5px] flex-col min-h-[30%]'>
          <TextInputComponent placeholder='Mobile Number' keyboardType='numeric' value={vendorMobileNumber} onChangeText={setVendorMobileNumber} maxLength={10} />
          {errorMessage && <View className='w-full border-red-400 border-2 rounded-[10px] p-2 mt-2 bg-red-300' >
            <Text className='text-[15px] text-white font-semibold text-center'>{errorMessage}</Text>
          </View>}
          <TouchableOpacity onPress={handleSendOTP} className='bg-primary w-full rounded-[10px] p-3 items-center justify-center' ><Text className='text-white text-lg font-semibold' >Send OTP</Text></TouchableOpacity>
        </View>
      }
      {confirmationResult &&
        <View className='bg-white rounded-[10px] p-5 w-[93%] max-w-md items-center justify-center gap-[5px] flex-col min-h-[30%]'>
          <TextInputComponent placeholder='6-Digit OTP' keyboardType='numeric' value={otp} onChangeText={setOtp} maxLength={6} />
          <Text className='text-center font-bold text-primaryGreen text-[12px]' >An OTP is sent to your device - {vendorMobileNumber}</Text>
          {errorMessage && <View className='w-full border-red-400 border-2 rounded-[10px] p-2 mt-2 bg-red-300' >
            <Text className='text-[15px] text-white font-semibold text-center'>{errorMessage}</Text>
          </View>}
          <TouchableOpacity onPress={confirmCode} className='bg-primary w-full rounded-[10px] p-3 items-center justify-center' ><Text className='text-white text-lg font-semibold' >Confirm OTP</Text></TouchableOpacity>
        </View>
      }
      {isVendorAllowedToSetNewPassword &&
        <View className='bg-white rounded-[10px] p-5 w-[93%] max-w-md items-center justify-center gap-[5px] flex-col min-h-[30%]'>
          <TextInputComponent placeholder='Enter New password' keyboardType='numeric' value={newPassword} onChangeText={setNewPassword} />
          {errorMessage && <View className='w-full border-red-400 border-2 rounded-[10px] p-2 mt-2 bg-red-300' >
            <Text className='text-[15px] text-white font-semibold text-center'>{errorMessage}</Text>
          </View>}
          <TouchableOpacity onPress={handleChangePassword} className='bg-primary w-full rounded-[10px] p-3 items-center justify-center' ><Text className='text-white text-lg font-semibold' >Confirm New Password</Text></TouchableOpacity>
        </View>
      }
    </View>
  )
}

export default ForgotPassword
