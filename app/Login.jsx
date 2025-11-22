import { View, Text, Image, TouchableOpacity, Linking, Modal } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import TextInputComponent from './components/TextInput'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Loader from './components/Loader.jsx'
import { doc, getDoc} from 'firebase/firestore'
import { db } from '@/firebase'

const Login = () => {
  const router = useRouter()
  const { setVendorMobileNumber, setVendorPassword, setVendorFullData } = useAuth()
  const params = useLocalSearchParams();
  const vendorMobileNumberFromURL = params.vendorMobileNumber || ''
  const vendorPasswordFromURL = params.vendorPassword || ''
  const [vendorMobileNumber, setVendorMobileNumberThisScreen] = useState('')
  const [isCommonLoaderVisible, setIsCommonLoaderVisible] = useState(false)
  const [vendorPassword, setVendorPasswordThisScreen] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (vendorMobileNumberFromURL && vendorMobileNumberFromURL.length === 10) {
      setVendorMobileNumberThisScreen(vendorMobileNumberFromURL);
    }
    if (vendorPasswordFromURL && vendorPasswordFromURL.length > 0) {
      setVendorPasswordThisScreen(vendorPasswordFromURL)
    }
  }, [vendorMobileNumberFromURL, vendorPasswordFromURL]);

  const validateForm = () => {
    const isMobileNumberValid = vendorMobileNumber.length === 10;
    const isPasswordValid = vendorPassword.length > 0;
    return (
      isMobileNumberValid && isPasswordValid
    );
  }

  const handleLoginPress = async () => {
    if (vendorMobileNumber.length !== 10) {
      setErrorMessage('Invalid Mobile Number')
      return;
    }
    if (vendorPassword.length === 0) {
      setErrorMessage('Invalid Password')
      return;
    }

    setErrorMessage('')
    try {
      setIsCommonLoaderVisible(true)
      const vendorRef = doc(db, 'users', vendorMobileNumber)
      const vendorDoc = await getDoc(vendorRef)
      const vendorData = vendorDoc.data()
      if (!vendorDoc.exists()) {
        setErrorMessage('Mobile number not found. Please Register.')
        return
      }

      if(vendorData.vendorPassword !== vendorPassword){
        setErrorMessage('Incorrect password, Please try again.')
        return;
      }

      if(!vendorData.vendorName){
        setErrorMessage('Please complete the registration.')
        router.push(`/SignUp/?vendorMobileNumber=${vendorMobileNumber}`)
        return;
      }

      await setVendorFullData(vendorData)

      await setVendorMobileNumber(vendorMobileNumber)
      await setVendorPassword(vendorPassword)
      router.push('/(tabs)/Home')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsCommonLoaderVisible(false)
    }
  }

  return (
    <View className='flex flex-1 bg-primary items-center justify-center gap-2' >
      {isCommonLoaderVisible && <Loader />}
      <Image style={{ height: 100, width: 100 }} source={require('../assets/images/icon.png')}></Image>
      <Text className='text-white text-2xl font-bold text-center'>Vendor Login</Text>
      <View className='bg-white rounded-[10px] p-5 w-[93%] max-w-md items-center justify-center gap-2 flex-col'>
        <View className='h-[70px] w-[70px] p-5 bg-primary rounded-full items-center justify-center' >
          <Image style={{ height: 35, width: 35 }} source={require('../assets/images/userImage.png')} />
        </View>

        <TextInputComponent
          placeholder='Mobile Number'
          keyboardType='number-pad'
          value={vendorMobileNumber}
          onChangeText={setVendorMobileNumberThisScreen}
          maxLength={10}
        />

        <TextInputComponent
          placeholder='Password'
          value={vendorPassword}
          onChangeText={setVendorPasswordThisScreen}
          secureTextEntry={true}
        />

        <View className='flex-row items-center justify-between w-full py-[7px]' >
          <Text className='text-primary text-sm font-semibold' onPress={() => router.push('/SignUp')}>Sign Up</Text>
          <Text className='text-primary text-sm font-semibold' onPress={() => router.push('/ForgotPassword')}>Forgot Password?</Text>
        </View>

        {errorMessage && <View className='w-full border-red-400 border-2 rounded-[10px] p-2 mt-2 bg-red-300' >
          <Text className='text-[15px] text-white font-semibold text-center'>{errorMessage}</Text>
        </View>}

        <TouchableOpacity className={`${validateForm() ? 'bg-primary' : 'bg-[#ccc]'} w-full rounded-[10px] p-3 items-center justify-center`} onPress={handleLoginPress} ><Text className='text-white text-lg font-semibold' >Login</Text></TouchableOpacity>
      </View>

      {errorMessage === 'Mobile number not found. Please Register.' &&
        <Modal animationType='slide' transparent={true} visible={true}>
          <View className={"h-screen bg-[#00000080] w-screen items-center justify-center"} >
            <View className='bg-white h-[40%] w-[95%] rounded-[10px] p-[10px] items-center justify-center gap-[10px]' >
              <TouchableOpacity
                onPress={() => setErrorMessage('')}
                className='absolute top-2 right-2 z-50'
              >
                <Image
                  source={require('../assets/images/crossImage.png')}
                  style={{ height: 30, width: 30 }}
                />
              </TouchableOpacity>
              <Text className='text-center text-[18px]' ><Text className='font-bold text-[20px] color-primary' >{vendorMobileNumber}</Text> is not registered.</Text>
              <Text className='text-center text-[18px]' >Do you want to Register it?</Text>

              <TouchableOpacity onPress={() => {
                router.push(`/SignUp/?vendorMobileNumber=${vendorMobileNumber}`)
                setErrorMessage('')
              }} className='w-[80%] rounded-[10px] p-[10px] bg-primary mt-[50px]' ><Text className='text-white text-center text-[18px]' >Yes</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      }

    </View>
  )
}

export default Login