import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Modal, FlatList } from 'react-native';
import { collection, addDoc, arrayUnion, updateDoc, doc, getDocs, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '../context/AuthContext'
import Loader from '../components/Loader'
import { Calendar, DateObject } from 'react-native-calendars';
import { LocaleConfig } from 'react-native-calendars';
import { toPng } from 'html-to-image';

export default function Home() {
  const { vendorMobileNumber, vendorFullData } = useAuth()
  const Section = {
    SALESANDOVERVIEW: 'salesandoverview',
    QUICKITEMEDITING: 'quickitemediting',
    SERVICEAREAFENCING: 'serviceareafencing',
    DELIVERYMODES: 'deliverymodes',
    DELIVERYCONDITIONS: 'deliveryconditions',
    MYOFFERS: 'myoffers',
    CATEGORIES: 'categories',
    ARRANGEITEMS: 'arrangeitems',
    MYQRS: 'myqrs',
    MYBANNERS: 'mybanners',
    SHARINGDETAILS: 'sharingdetails',
    NONE: null,
  };
  const [activeSection, setActiveSection] = useState(Section.SALESANDOVERVIEW);
  const toggleSection = (sectionName) => {
    setActiveSection(activeSection === sectionName ? Section.NONE : sectionName);
  };
  const isSectionActive = (sectionName) => activeSection === sectionName;
  const [vendorItemsList, setVendorItemsList] = useState([])
  const [categories, setCategories] = useState([])
  const [newVariantName, setNewVariantName] = useState('')
  const [newVariantSellingPrice, setNewVariantSellingPrice] = useState('')
  const [newVariantMeasurement, setNewVariantMeasurement] = useState('')
  const [newVariantMRP, setNewVariantMRP] = useState('')
  const [newVariantStock, setNewVariantStock] = useState('')
  const [newVariantBuyingPrice, setNewVariantBuyingPrice] = useState('')
  const [addNewVariantSectionVisibleFor, setAddNewVariantSectionVisibleFor] = useState(null)
  const [isBulkEditingLoaderVisible, setIsBulkEditingLoaderVisible] = useState(false)
  const [addNewItemSectionVisibleFor, setAddNewItemSectionVisibleFor] = useState(null)
  const [newItemName, setNewItemName] = useState('')
  const [editingField, setEditingField] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});
  const [showSaveAlert, setShowSaveAlert] = useState(false);
  const [nextEditField, setNextEditField] = useState(null);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [ordersToSummarize, setOrdersToSummarize] = useState({})
  const [selectedOrderStatus, setSelectedOrderStatus] = useState('Pending')
  const [isTotalItemsListModalVisible, setIsTotalItemsListModalVisible] = useState(false)
  const [isDeliverySortSelected, setIsDeliverySortSelected] = useState(false)
  const [selectedDeliveryFilters, setSelectedDeliveryFilters] = useState([])
  const [isTimeSortSelected, setIsTimeSortSelected] = useState(false)
  const [selectedTimeFilter, setSelectedTimeFilter] = useState(null)
  const [isCustomRangeModalVisible, setIsCustomRangeModalVisible] = useState(false)
  const [customStartDate, setCustomStartDate] = useState(null)
  const [customEndDate, setCustomEndDate] = useState(null)
  LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  };
  LocaleConfig.defaultLocale = 'en';
  const [isStatusSortSelected, setIsStatusSortSelected] = useState(false)
  const [selectedStatusFilters, setSelectedStatusFilters] = useState(['Pending'])
  const [isSelectedOrderItemsListModalVisible, setIsSelectedOrderItemsListModalVisible] = useState(false)
  const [orderToShowItemsFor, setOrderToShowItemsFor] = useState([])
  const [orderForAction, setOrderForAction] = useState([])
  const [isPrintingModalForSelectedOrdersVisible, setIsPrintingModalForSelectedOrdersVisible] = useState(false)
  const [vendorFullAddress, setVendorFullAddress] = useState('')
  const billRef = useRef(null);
  const [isEditOrderModalVisible, setIsEditOrderModalVisible] = useState(false)
  // const [newVendorCommentForOrder, setNewVendorCommentForOrder] = useState('')
  const [isSalesLoaderVisible, setIsSalesLoaderVisible] = useState(false)
  const [newSellingPricesForEditingOrder, setNewSellingPricesForEditingOrder] = useState({})
  const [newQtysForEditingOrder, setNewQtysForEditingOrder] = useState({})
  const [isPrintingModalVisible, setIsPrintingModalVisible] = useState(false)
  const [orderForPrinting, setOrderForPrinting] = useState([])

  const fetchVendorItemsList = async () => {
    try {
      const vendorItemsRef = collection(db, 'users', vendorMobileNumber, 'list')
      const vendorItemsSnap = await getDocs(vendorItemsRef)
      const vendorItems = vendorItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setVendorItemsList(vendorItems)
    } catch (err) {
      console.error('Error fetching Items list:', err)
    }
  }

  const fetchVendorCategories = async () => {
    if (!vendorMobileNumber) return;
    try {
      const vendorCategoriesRef = collection(db, 'users', vendorMobileNumber, 'categories');
      const vendorCategoriesDocs = await getDocs(vendorCategoriesRef);
      const vendorCategoriesData = vendorCategoriesDocs.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (a.position || 0) - (b.position || 0));

      setCategories(vendorCategoriesData);
    } catch (error) {
      console.log('Error fetching categories: ', error);
    }
  };

  const fetchVendorOrders = async () => {
    try {

      // First, get all customers
      const customersRef = collection(db, 'customers');
      const customersSnapshot = await getDocs(customersRef);

      const allOrders = [];

      // Loop through each customer and check their orders
      for (const customerDoc of customersSnapshot.docs) {
        const customerMobileNumber = customerDoc.id;

        try {
          // Get the myOrders subcollection for this customer
          const ordersRef = collection(db, 'customers', customerMobileNumber, 'myOrders');
          const ordersSnapshot = await getDocs(ordersRef);

          // Filter orders that match the current vendor's mobile number
          const vendorOrdersFromCustomer = ordersSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              customerMobileNumber // Include customer info for reference
            }))
            .filter(order => order.vendorMobileNumber === vendorMobileNumber);

          allOrders.push(...vendorOrdersFromCustomer);
        } catch (error) {
          console.log(`Error fetching orders for customer ${customerMobileNumber}:`, error);
          // Continue with other customers even if one fails
          continue;
        }
      }

      // Sort orders by timestamp (newest first) or any other criteria
      const sortedOrders = allOrders.sort((a, b) => {
        const timeA = a.orderTime?.toDate?.() || new Date(a.timestamp || 0);
        const timeB = b.orderTime?.toDate?.() || new Date(b.timestamp || 0);
        return timeB - timeA;
      });

      setVendorOrders(sortedOrders);

    } catch (err) {
      console.error('Error fetching orders: ', err);
      alert('Error fetching orders. Please try again.');
    } finally {
    }
  }

  const fetchVendorAddress = async () => {
    try {
      if (!vendorMobileNumber) {
        console.warn("Vendor mobile number is missing, cannot fetch address.");
        return;
      }
      const vendorAddressesRef = collection(db, 'users', vendorMobileNumber, 'savedAddresses');
      const vendorAddressesSnap = await getDocs(vendorAddressesRef);
      if (!vendorAddressesSnap.empty) {
        const addressDoc = vendorAddressesSnap.docs[0];
        if (addressDoc) {
          const addressData = addressDoc.data();
          setVendorFullAddress(prevFullData => {
            const updatedFullData = {
              ...prevFullData,
              createdAt: addressData.createdAt,
              updatedAt: addressData.updatedAt,
              vendorBusinessCity: addressData.vendorBusinessCity,
              vendorBusinessComplexNameOrBuildingName: addressData.vendorBusinessComplexNameOrBuildingName,
              vendorBusinessLandmark: addressData.vendorBusinessLandmark,
              vendorBusinessPincode: addressData.vendorBusinessPincode,
              vendorBusinessPlotNumberOrShopNumber: addressData.vendorBusinessPlotNumberOrShopNumber,
              vendorBusinessRoadNameOrStreetName: addressData.vendorBusinessRoadNameOrStreetName,
              vendorBusinessState: addressData.vendorBusinessState,
              vendorBusinessVillageNameOrTownName: addressData.vendorBusinessVillageNameOrTownName,
              vendorLocation: addressData.vendorLocation,
            };
            return updatedFullData;
          });
        } else {
          console.warn("No address document found for the vendor.");
        }
      } else {
        console.warn("No addresses found for the vendor.");
      }
    } catch (error) {
      console.error("Error fetching vendor address:", error);
    }
  }

  useEffect(() => {
    if (vendorMobileNumber) {
      fetchVendorCategories()
      fetchVendorAddress()
    }
  }, [vendorMobileNumber])

  useEffect(() => {
    if (!vendorMobileNumber) return;

    const vendorItemsRef = collection(db, 'users', vendorMobileNumber, 'list');
    const unsubscribe = onSnapshot(vendorItemsRef,
      (snapshot) => {
        const vendorItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setVendorItemsList(vendorItems);
      },
      (error) => {
        console.error('Error fetching Items list:', error);
      }
    );

    return () => unsubscribe();
  }, [vendorMobileNumber]);

  useEffect(() => {
    if (!vendorMobileNumber) return;

    const customersRef = collection(db, 'customers');
    const unsubscribers = []; // To clean up all listeners

    const unsubscribeCustomers = onSnapshot(
      customersRef,
      (customersSnapshot) => {
        const allOrders = [];
        const orderUnsubscribers = [];

        // For each customer, set up a LIVE listener on their myOrders
        customersSnapshot.docs.forEach((customerDoc) => {
          const customerMobileNumber = customerDoc.id;
          const ordersRef = collection(db, 'customers', customerMobileNumber, 'myOrders');

          const unsubscribeOrders = onSnapshot(
            ordersRef,
            (ordersSnapshot) => {
              // Clear previous orders from this customer
              setVendorOrders((prev) => {
                return prev.filter((order) => order.customerMobileNumber !== customerMobileNumber);
              });

              // Add only vendor's orders from this customer
              const vendorOrdersFromCustomer = ordersSnapshot.docs
                .map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                  customerMobileNumber,
                }))
                .filter((order) => order.vendorMobileNumber === vendorMobileNumber);

              // Append new ones
              setVendorOrders((prev) => {
                const updated = [...prev, ...vendorOrdersFromCustomer];
                // Sort by latest first
                return updated.sort((a, b) => {
                  const timeA = a.orderTime?.toDate?.() || new Date(a.timestamp || 0);
                  const timeB = b.orderTime?.toDate?.() || new Date(b.timestamp || 0);
                  return timeB - timeA;
                });
              });
            },
            (error) => {
              console.error(`Error listening to orders for ${customerMobileNumber}:`, error);
            }
          );

          orderUnsubscribers.push(unsubscribeOrders);
        });

        // Clean up previous order listeners (important!)
        unsubscribers.forEach((unsub) => unsub());
        unsubscribers.length = 0;
        unsubscribers.push(...orderUnsubscribers);
      },
      (error) => {
        console.error('Error in customers listener:', error);
      }
    );

    // Cleanup all listeners on unmount or vendor change
    return () => {
      unsubscribeCustomers();
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [vendorMobileNumber]);;

  const generateVariantId = (indexORName = 0) => {
    // Create a URL-safe variant ID without spaces or special characters
    const safeName = String(indexORName).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `variant_${Date.now()}_${safeName}_${Math.random().toString(36).substr(2, 5)}`;
  };

  const handleAddNewVariant = async () => {
    setIsBulkEditingLoaderVisible(true)
    // Validation
    if (!newVariantName.trimEnd() || !newVariantBuyingPrice || !newVariantMRP ||
      !newVariantSellingPrice || !newVariantMeasurement || !newVariantStock) {
      alert('Incomplete Information', 'Please fill all fields');
      setIsBulkEditingLoaderVisible(false)
      return;
    }

    const baseItem = vendorItemsList.find(item => item.id === addNewVariantSectionVisibleFor);
    if (!baseItem) return;

    // Check for duplicate variant name
    const variantExists = baseItem?.variants?.some(
      v => v.variantName?.toLowerCase().trimEnd() === newVariantName.toLowerCase().trimEnd()
    );

    if (variantExists) {
      alert('Duplicate Variant', 'A variant with this name already exists');
      setIsBulkEditingLoaderVisible(false)
      return;
    }

    const variantId = generateVariantId(newVariantName); // unique ID

    const newVariant = {
      id: variantId,
      variantName: newVariantName.trimEnd(),
      variantDescription: '',
      hidden: false,
      variantStock: Number(newVariantStock),
      prices: [{
        variantMeasurement: newVariantMeasurement.trimEnd(),
        variantMrp: String(newVariantMRP),
        variantPrice: String(newVariantBuyingPrice),
        variantSellingPrice: String(newVariantSellingPrice),
      }],
    };

    try {

      // Update Firestore
      const itemRef = doc(db, 'users', vendorMobileNumber, 'list', addNewVariantSectionVisibleFor);
      await updateDoc(itemRef, {
        variants: arrayUnion(newVariant)
      });

      fetchVendorItemsList()

      // Reset form & close
      setNewVariantName('');
      setNewVariantBuyingPrice('');
      setNewVariantSellingPrice('');
      setNewVariantMRP('');
      setNewVariantMeasurement('');
      setNewVariantStock('');
      setAddNewVariantSectionVisibleFor(null);

      alert('Variant added successfully!');

    } catch (error) {
      console.error("Error adding variant: ", error);
      alert('Error', 'Failed to add variant. Please try again.');
    } finally {
      setIsBulkEditingLoaderVisible(false)
    }
  };

  const handleAddNewItem = async () => {
    setIsBulkEditingLoaderVisible(true);

    if (
      !newItemName.trimEnd() ||
      !newVariantName.trimEnd() ||
      !newVariantSellingPrice.trimEnd() ||
      !newVariantMeasurement.trimEnd() ||
      !newVariantMRP.trimEnd() ||
      !newVariantStock.trimEnd() ||
      !newVariantBuyingPrice.trimEnd()
    ) {
      alert('Incomplete Information', 'Please fill all required fields (Item Name, Variant Name, and all Price/Stock fields).');
      setIsBulkEditingLoaderVisible(false);
      return;
    }

    const categoryId = addNewItemSectionVisibleFor;
    if (!categoryId) {
      alert('Error', 'Category is not selected for the new item.');
      setIsBulkEditingLoaderVisible(false);
      return;
    }

    // const itemExists = vendorItemsList.some(
    //   (item) => item.name?.toLowerCase().trimEnd() === newItemName.toLowerCase().trimEnd()
    // );
    // if (itemExists) {
    //   alert('Duplicate Item', 'An item with this name already exists in this category.');
    //   setIsBulkEditingLoaderVisible(false);
    //   return;
    // }

    const newVariantId = generateVariantId(newVariantName.trimEnd());

    // Build first variant
    const firstVariant = {
      id: newVariantId,
      variantName: newVariantName.trimEnd(),
      variantDescription: '',
      hidden: false,
      variantStock: Number(newVariantStock),
      prices: [{
        variantMeasurement: newVariantMeasurement.trimEnd(),
        variantMrp: newVariantMRP.trimEnd(),
        variantPrice: newVariantBuyingPrice.trimEnd(),
        variantSellingPrice: newVariantSellingPrice.trimEnd(),
      }],
    };

    // Temporary item without ID
    const tempItem = {
      name: newItemName.trimEnd(),
      categoryId: categoryId,
      hidden: false,
      position: Date.now(),
      variants: [firstVariant],
      prices: [{
        measurement: newVariantMeasurement.trimEnd(),
        mrp: Number(newVariantMRP.trimEnd()),
        price: Number(newVariantBuyingPrice.trimEnd()),
        sellingPrice: Number(newVariantSellingPrice.trimEnd()),
      }],
      stock: Number(newVariantStock.trimEnd())
    };

    try {
      const itemsCollectionRef = collection(db, 'users', vendorMobileNumber, 'list');
      const docRef = await addDoc(itemsCollectionRef, tempItem);

      fetchVendorItemsList()

      // Success & Reset
      alert('New item added successfully!');

      // Reset form
      setNewItemName('');
      setNewVariantName('');
      setNewVariantSellingPrice('');
      setNewVariantMeasurement('');
      setNewVariantMRP('');
      setNewVariantStock('');
      setNewVariantBuyingPrice('');
      setAddNewItemSectionVisibleFor(null);

    } catch (error) {
      console.error('Error adding new item:', error);
      alert('Error', 'Failed to add item. Please try again. Check database permissions or network.');
    } finally {
      setIsBulkEditingLoaderVisible(false);
    }
  };

  const handleSaveField = async (itemId, variantId, fieldName, newValue) => {
    // Additional validation to prevent empty values
    if (!newValue || newValue.toString().trim() === '') {
      alert('Empty values are not allowed');
      return;
    }

    setIsBulkEditingLoaderVisible(true);
    try {
      const itemRef = doc(db, 'users', vendorMobileNumber, 'list', itemId);
      const item = vendorItemsList.find(item => item.id === itemId);
      if (!item) {
        alert('Error', 'Item not found');
        return;
      }

      let updateData = {};

      if (variantId) {
        // Updating a variant field
        const updatedVariants = item.variants.map(variant => {
          if (variant.id === variantId) {
            const updatedVariant = { ...variant };
            switch (fieldName) {
              case 'variantName':
                updatedVariant.variantName = newValue.trim();
                break;
              case 'sellingPrice':
                if (updatedVariant.prices?.[0]) {
                  updatedVariant.prices[0].variantSellingPrice = String(newValue);
                }
                break;
              case 'measurement':
                if (updatedVariant.prices?.[0]) {
                  updatedVariant.prices[0].variantMeasurement = newValue.trim();
                }
                break;
              case 'mrp':
                if (updatedVariant.prices?.[0]) {
                  updatedVariant.prices[0].variantMrp = String(newValue);
                }
                break;
              case 'stock':
                updatedVariant.variantStock = Number(newValue);
                break;
              case 'buyingPrice':
                if (updatedVariant.prices?.[0]) {
                  updatedVariant.prices[0].variantPrice = String(newValue);
                }
                break;
              case 'buyingLimit':
                updatedVariant.buyingLimit = Number(newValue);
                break;
              default:
                console.warn('Unknown field:', fieldName);
            }
            return updatedVariant;
          }
          return variant;
        });
        updateData.variants = updatedVariants;
      } else {
        // Updating main item fields (for items without variants)
        switch (fieldName) {
          case 'sellingPrice':
            if (item.prices?.[0]) {
              updateData['prices.0.sellingPrice'] = Number(newValue);
            }
            break;
          case 'measurement':
            if (item.prices?.[0]) {
              updateData['prices.0.measurement'] = newValue.trim();
            }
            break;
          case 'mrp':
            if (item.prices?.[0]) {
              updateData['prices.0.mrp'] = Number(newValue);
            }
            break;
          case 'stock':
            updateData.stock = Number(newValue);
            break;
          case 'buyingPrice':
            if (item.prices?.[0]) {
              updateData['prices.0.price'] = Number(newValue);
            }
            break;
          default:
            console.warn('Unknown field:', fieldName);
        }
      }

      // Only update if we have changes
      if (Object.keys(updateData).length > 0) {
        await updateDoc(itemRef, updateData);
        await fetchVendorItemsList(); // Refresh the data
        alert('Field updated successfully!');
      }
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsBulkEditingLoaderVisible(false);
    }
  };

  const EditableField = ({
    itemId,
    variantId,
    fieldName,
    value,
    width,
    placeholder,
    keyboardType = 'default',
    onSave,
    placeholderTextColor = '#ccc'
  }) => {
    const isEditing = editingField?.itemId === itemId &&
      editingField?.variantId === variantId &&
      editingField?.fieldName === fieldName;

    const handlePress = () => {
      const isSameField = editingField?.itemId === itemId &&
        editingField?.variantId === variantId &&
        editingField?.fieldName === fieldName;

      if (editingField && !isSameField) {
        // Different field is being edited, ask user what to do
        setNextEditField({ itemId, variantId, fieldName, value });
        setShowSaveAlert(true);
      } else {
        // Start editing this field (either no field editing or same field)
        setEditingField({ itemId, variantId, fieldName, value });
        setPendingChanges(prev => ({
          ...prev,
          [`${itemId}-${variantId}-${fieldName}`]: value || ''
        }));
      }
    };

    const handleSave = () => {
      const currentValue = pendingChanges[`${itemId}-${variantId}-${fieldName}`];

      // Check if the field is empty after trimming
      if (currentValue !== undefined && currentValue.trim() === '') {
        alert('Empty values are not allowed');
        return;
      }

      const newValue = currentValue !== undefined ? currentValue : value;

      // Additional check for the original value
      if (!newValue || newValue.toString().trim() === '') {
        alert('Empty values are not allowed');
        return;
      }

      onSave(itemId, variantId, fieldName, newValue);
      setEditingField(null);
      setPendingChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[`${itemId}-${variantId}-${fieldName}`];
        return newChanges;
      });
    };

    const handleCancel = () => {
      setEditingField(null);
      setPendingChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[`${itemId}-${variantId}-${fieldName}`];
        return newChanges;
      });
    };

    const handleChangeText = (text) => {
      setPendingChanges(prev => ({
        ...prev,
        [`${itemId}-${variantId}-${fieldName}`]: text
      }));
    };

    if (isEditing) {
      return (
        <View style={{ alignItems: 'center', width: width }}>
          <TextInput
            value={pendingChanges[`${itemId}-${variantId}-${fieldName}`] !== undefined
              ? pendingChanges[`${itemId}-${variantId}-${fieldName}`]
              : value || ''}
            onChangeText={handleChangeText}
            keyboardType={keyboardType}
            className={`border border-blue-500 text-center text-black text-[12px] py-[5px] w-[${width}px]`}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor}
            autoFocus
          />
          <View style={{ flexDirection: 'row', marginLeft: 4 }}>
            <TouchableOpacity onPress={handleSave} className="bg-green-500 px-2 py-1 rounded">
              <Text className="text-white text-[10px]">✓</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancel} className="bg-red-500 px-2 py-1 rounded ml-1">
              <Text className="text-white text-[10px]">✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity onPress={handlePress} style={{ width }}>
        <Text className="border border-[#ccc] text-center text-black text-[12px] py-[5px]">
          {value || placeholder}
        </Text>
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    // Cleanup when component unmounts
    return () => {
      setEditingField(null);
      setPendingChanges({});
      setShowSaveAlert(false);
      setNextEditField(null);
    };
  }, []);

  const handleDeleteVariant = async (baseItem, variant) => {
    // Show confirmation dialog for web
    const isConfirmed = window.confirm(
      `Are you sure you want to delete "${variant.variantName}"?`
    );

    if (!isConfirmed) return;

    setIsBulkEditingLoaderVisible(true);
    try {
      const itemRef = doc(db, 'users', vendorMobileNumber, 'list', baseItem.id);

      // Filter out the variant to be deleted
      const updatedVariants = baseItem.variants.filter(v => v.id !== variant.id);

      // Update Firestore with the filtered variants array
      await updateDoc(itemRef, {
        variants: updatedVariants
      });

      if (updatedVariants?.length === 0) {
        await deleteDoc(itemRef)
      }
      // Refresh the data
      await fetchVendorItemsList();

      alert('Variant deleted successfully!');
    } catch (error) {
      console.error('Error deleting variant:', error);
      alert('Error: Failed to delete variant. Please try again.');
    } finally {
      setIsBulkEditingLoaderVisible(false);
    }
  }

  const getDatesInRange = (startDate, endDate) => {
    if (!startDate || !endDate) return {};

    const dates = {};
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    // Reset times to avoid timezone issues
    currentDate.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);

    while (currentDate <= lastDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      dates[dateString] = {
        selected: true,
        color: '#00adf5',
        textColor: '#ffffff'
      };

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  const shareBill = async () => {
    if (!billRef.current) return;

    try {
      const dataUrl = await toPng(billRef.current, {
        quality: 1,
        pixelRatio: 2, // High quality
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
        },
      });

      // Convert data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const file = new File([blob], 'bill.png', { type: 'image/png' });

      // Use Web Share API
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Bill',
          text: 'Here is your bill from ' + vendorFullData?.businessName,
        });
      } else {
        // Fallback: download image
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'bill.png';
        link.click();
      }
    } catch (err) {
      console.error('Share failed:', err);
      alert('Share failed. Image downloaded instead.');

      // Fallback download
      const link = document.createElement('a');
      // link.href = dataUrl;
      link.download = 'bill.png';
      link.click();
    }
  };

  const handleApproveOrder = async (order) => {
    if (!window.confirm(`Are you sure you want to approve this order?\n\nOrder Id: ${order?.id}\n\nTotal Amount: ₹${order?.totalAmount}`)) return
    setIsSalesLoaderVisible(true);
    const orderRef = doc(db, `customers/${order?.customerMobileNumber}/myOrders`, order?.id);
    try {
      await updateDoc(orderRef, { orderStatus: 'Approved', vendorComment: '' });
      setOrderForAction([])
      setVendorOrders((prev) => prev.map(ord =>
        ord.id === order.id ? { ...ord, orderStatus: 'Approved' } : ord
      ));
      alert("Order approved successfully!");
    } catch (error) {
      console.error("Error approving order:", error);
      alert("Failed to approve order.");
    } finally {
      setIsSalesLoaderVisible(false);
    }
  };

  const handleRejectOrder = async (order) => {
    if (!window.confirm(`Are you sure you want to Reject this order?\n\nOrder Id: ${order?.id}\n\nTotal Amount: ₹${order?.totalAmount}`)) return
    setIsSalesLoaderVisible(true);
    const orderRef = doc(db, `customers/${order.customerMobileNumber}/myOrders`, order.id);

    try {
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        alert("Order not found.");
        return;
      }

      const orderData = orderSnap.data();
      const items = orderData.items || [];

      // Group items by baseItemId (for variants) and itemId (for regular items)
      const itemGroups = {};

      items.forEach(item => {
        const stockSubtracted = item.quantity || 0;

        if (item.variantId && item.variantId !== '') {
          // Variant item - group by baseItemId
          const key = `variant_${item.baseItemId}`;
          if (!itemGroups[key]) {
            itemGroups[key] = {
              type: 'variant',
              baseItemId: item.baseItemId,
              updates: []
            };
          }
          itemGroups[key].updates.push({
            variantId: item.variantId,
            stockSubtracted,
            itemName: item.name,
            variantName: item.variantName
          });
        } else {
          // Regular item - group by itemId
          const key = `regular_${item.id}`;
          if (!itemGroups[key]) {
            itemGroups[key] = {
              type: 'regular',
              itemId: item.id,
              stockSubtracted: 0
            };
          }
          itemGroups[key].stockSubtracted += stockSubtracted;
        }
      });

      const stockUpdatePromises = Object.values(itemGroups).map(async (group) => {
        if (group.type === 'variant') {
          const itemRef = doc(db, `users/${vendorMobileNumber}/list/${group.baseItemId}`);
          const itemSnap = await getDoc(itemRef);

          if (itemSnap.exists()) {
            const itemData = itemSnap.data();
            const variants = itemData.variants || [];
            const updatedVariants = [...variants];

            // Apply all variant updates for this base item
            group.updates.forEach(update => {
              const variantIndex = updatedVariants.findIndex(variant => variant.id === update.variantId);

              if (variantIndex === -1) {
                console.warn(`Variant ${update.variantId} not found for item ${update.itemName}`);
                return;
              }

              const currentVariantStock = Number(updatedVariants[variantIndex].variantStock) || 0;
              const updatedVariantStock = currentVariantStock + Number(update.stockSubtracted);

              updatedVariants[variantIndex] = {
                ...updatedVariants[variantIndex],
                variantStock: updatedVariantStock
              };
            });

            await updateDoc(itemRef, { variants: updatedVariants });
          } else {
            console.warn(`Base item ${group.baseItemId} not found for stock restoration.`);
          }
        } else {
          // Regular item
          const itemRef = doc(db, `users/${vendorMobileNumber}/list/${group.itemId}`);
          const itemSnap = await getDoc(itemRef);

          if (itemSnap.exists()) {
            const itemData = itemSnap.data();
            const currentStock = itemData.stock || 0;
            const updatedStock = Number(currentStock) + Number(group.stockSubtracted);
            await updateDoc(itemRef, { stock: Number(updatedStock) });
          } else {
            console.warn(`Item ${group.itemId} not found for stock restoration.`);
          }
        }
      });

      await Promise.all(stockUpdatePromises);
      await updateDoc(orderRef, { orderStatus: 'Rejected' });

      // Also update vendor's order copy
      const vendorOrderRef = doc(db, `users/${vendorMobileNumber}/myOrders`, order.id);
      await updateDoc(vendorOrderRef, { orderStatus: 'Rejected' });

      setVendorOrders((prev) => prev.map(ord =>
        ord.id === order.id ? { ...ord, orderStatus: 'Rejected' } : ord
      ));

      setOrderForAction([]);

      alert("Order has been rejected, and the stock has been restored.");
    } catch (error) {
      console.error("Error rejecting order or restoring stock:", error);
      alert("Failed to reject order and restore stock.");
    } finally {
      setIsSalesLoaderVisible(false);
    }
  };

  const handleSaveOrderChanges = async () => {
    if (!orderForAction?.id) return;

    setIsSalesLoaderVisible(true);

    try {
      const orderRef = doc(db, `customers/${orderForAction.customerMobileNumber}/myOrders`, orderForAction.id);

      // Update items with new quantities and prices (handle empty strings)
      const updatedItems = orderForAction.items.map(item => {
        const newQty = newQtysForEditingOrder[item.id] !== undefined
          ? (newQtysForEditingOrder[item.id] === '' ? 0 : Number(newQtysForEditingOrder[item.id]))
          : Number(item.quantity);

        const newSellingPrice = newSellingPricesForEditingOrder[item.id] !== undefined
          ? (newSellingPricesForEditingOrder[item.id] === '' ? 0 : Number(newSellingPricesForEditingOrder[item.id]))
          : Number(item?.price?.[0]?.sellingPrice);

        return {
          ...item,
          quantity: newQty,
          price: [{
            ...item.price[0],
            sellingPrice: newSellingPrice
          }]
        };
      });

      // Calculate new totals
      const newSubTotal = updatedItems.reduce((total, item) => {
        const sellingPrice = Number(item?.price?.[0]?.sellingPrice) || 0;
        const quantity = Number(item.quantity) || 0;
        return total + (sellingPrice * quantity);
      }, 0);

      const newTotalAmount = newSubTotal + Number(orderForAction.deliveryCharge || 0) - Number(orderForAction.totalDiscount || 0);

      // Stock management: Update item stock based on quantity changes
      const stockUpdatePromises = orderForAction.items.map(async (originalItem) => {
        const updatedItem = updatedItems.find(item => item.id === originalItem.id);
        if (!updatedItem) return;

        const originalQty = Number(originalItem.quantity) || 0;
        const newQty = Number(updatedItem.quantity) || 0;
        const quantityDifference = newQty - originalQty;

        // If quantity hasn't changed, no need to update stock
        if (quantityDifference === 0) return;

        try {
          if (updatedItem.variantId && updatedItem.variantId !== '') {
            // Handle variant item stock update
            const itemRef = doc(db, `users/${vendorMobileNumber}/list/${updatedItem.baseItemId}`);
            const itemSnap = await getDoc(itemRef);

            if (itemSnap.exists()) {
              const itemData = itemSnap.data();
              const variants = itemData.variants || [];
              const updatedVariants = variants.map(variant => {
                if (variant.id === updatedItem.variantId) {
                  const currentStock = Number(variant.variantStock) || 0;
                  const updatedStock = currentStock - quantityDifference; // Subtract difference
                  return {
                    ...variant,
                    variantStock: Math.max(0, updatedStock) // Ensure stock doesn't go negative
                  };
                }
                return variant;
              });

              await updateDoc(itemRef, { variants: updatedVariants });
            }
          } else {
            // Handle regular item stock update
            const itemRef = doc(db, `users/${vendorMobileNumber}/list/${updatedItem.id}`);
            const itemSnap = await getDoc(itemRef);

            if (itemSnap.exists()) {
              const itemData = itemSnap.data();
              const currentStock = Number(itemData.stock) || 0;
              const updatedStock = currentStock - quantityDifference; // Subtract difference
              await updateDoc(itemRef, {
                stock: Math.max(0, updatedStock) // Ensure stock doesn't go negative
              });
            }
          }
        } catch (error) {
          console.error(`Error updating stock for item ${updatedItem.name}:`, error);
          throw new Error(`Failed to update stock for ${updatedItem.name}`);
        }
      });

      // Wait for all stock updates to complete
      await Promise.all(stockUpdatePromises);

      // Update Firestore order
      await updateDoc(orderRef, {
        items: updatedItems,
        totalAmount: newTotalAmount
      });

      // Update local state
      setVendorOrders(prev => prev.map(order =>
        order.id === orderForAction.id
          ? {
            ...order,
            items: updatedItems,
            totalAmount: newTotalAmount
          }
          : order
      ));

      // Refresh vendor items list to reflect stock changes
      await fetchVendorItemsList();

      alert("Order updated successfully and stock adjusted!");
      setIsEditOrderModalVisible(false);
      setOrderForAction([]);

      // Reset editing states
      setNewQtysForEditingOrder({});
      setNewSellingPricesForEditingOrder({});

    } catch (error) {
      console.error("Error updating order:", error);
      alert("Failed to update order. Please try again.");
    } finally {
      setIsSalesLoaderVisible(false);
    }
  };

  return (
    <View>

      <ScrollView showsHorizontalScrollIndicator={false} contentContainerClassName="gap-[2px]" className="w-full max-h-[70px]" horizontal>
        {/* Sales */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.SALESANDOVERVIEW)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.SALESANDOVERVIEW) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >Sales & Overview</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center" >({allVendorsList?.length || 0})</Text> */}
        </TouchableOpacity>

        {/* Bulk Editing */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.QUICKITEMEDITING)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.QUICKITEMEDITING) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >Quick Item Editing</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center" >({allVendorsList?.length || 0})</Text> */}
        </TouchableOpacity>

        {/* Service Area Fencing */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.SERVICEAREAFENCING)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.SERVICEAREAFENCING) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >Service Area Fencing</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center" >({allCustomersList?.length || 0})</Text> */}
        </TouchableOpacity>

        {/* Delivery Modes */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.DELIVERYMODES)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.DELIVERYMODES) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >Delivery Modes</Text>
        </TouchableOpacity>

        {/* Delivery Conditions */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.DELIVERYCONDITIONS)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.DELIVERYCONDITIONS) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >Delivery Conditions</Text>
        </TouchableOpacity>

        {/* My Offers */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.MYOFFERS)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.MYOFFERS) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >My Offers</Text>
        </TouchableOpacity>

        {/* Category */}
        <TouchableOpacity
          onPress={() => {
            toggleSection(Section.CATEGORIES);
          }}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.CATEGORIES) ? 'bg-wheat' : 'bg-white'
            } border-primary p-[10px] items-center justify-center`}
        >
          <Text className="font-bold text-primary text-[16px] text-center">Category</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center">({assetsList.length})</Text> */}
        </TouchableOpacity>

        {/* Arrange Items */}
        <TouchableOpacity
          onPress={() => {
            toggleSection(Section.ARRANGEITEMS);
          }}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.ARRANGEITEMS) ? 'bg-wheat' : 'bg-white'
            } border-primary p-[10px] items-center justify-center`}
        >
          <Text className="font-bold text-primary text-[16px] text-center">Arrange Items</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center">({assetsList.length})</Text> */}
        </TouchableOpacity>

        {/* My QR(s) */}
        <TouchableOpacity
          onPress={() => {
            toggleSection(Section.MYQRS);
          }}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.MYQRS) ? 'bg-wheat' : 'bg-white'
            } border-primary p-[10px] items-center justify-center`}
        >
          <Text className="font-bold text-primary text-[16px] text-center">My QR(s)</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center">({assetsList.length})</Text> */}
        </TouchableOpacity>

        {/* My Banners */}
        <TouchableOpacity
          onPress={() => {
            toggleSection(Section.MYBANNERS);
          }}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.MYBANNERS) ? 'bg-wheat' : 'bg-white'
            } border-primary p-[10px] items-center justify-center`}
        >
          <Text className="font-bold text-primary text-[16px] text-center">My Banners</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center">({assetsList.length})</Text> */}
        </TouchableOpacity>

        {/* Sharing Details */}
        <TouchableOpacity
          onPress={() => {
            toggleSection(Section.SHARINGDETAILS);
          }}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.SHARINGDETAILS) ? 'bg-wheat' : 'bg-white'
            } border-primary p-[10px] items-center justify-center`}
        >
          <Text className="font-bold text-primary text-[16px] text-center">Sharing Details</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center">({assetsList.length})</Text> */}
        </TouchableOpacity>
      </ScrollView>

      <View className='flex-1'>
        {activeSection === 'salesandoverview' && (
          <View className='flex-1' >
            {isSalesLoaderVisible && (<Loader />)}
            {Object.keys(ordersToSummarize).length > 0 && (
              <>
                {/* Clear Selection Button - Smaller */}
                <TouchableOpacity
                  onPress={() => setOrdersToSummarize({})}
                  className="bg-primaryRed p-[5px] rounded-[5px] absolute top-[5px] right-[0px] z-50"
                >
                  <Text className="text-white text-center">Clear Selection</Text>
                </TouchableOpacity>
                <Text className="text-[16px] font-bold text-center p-[10px]">Order Summary</Text>

                {/* Summary Stats in horizontal scroll */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 5, gap: 5 }}>
                  <View className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Selected Orders</Text>
                    <Text className="text-[18px] font-bold text-blue-600">{Object.keys(ordersToSummarize).length}</Text>
                  </View>

                  <TouchableOpacity onPress={() => setIsTotalItemsListModalVisible(true)} className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Total Items</Text>
                    <Text className="text-[18px] font-bold text-purple-600">
                      {Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (order?.items?.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0) || 0), 0)}
                    </Text>
                  </TouchableOpacity>

                  <View className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Grand Total</Text>
                    <Text className="text-[16px] font-bold text-green-600">
                      ₹{Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (Number(order?.totalAmount) || 0), 0).toFixed(2)}
                    </Text>
                  </View>

                  <View className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Sub Total</Text>
                    <Text className="text-[16px] font-bold text-orange-600">
                      ₹{Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (order?.items?.reduce((sum, item) => {
                          const sellingPrice = Number(item?.price?.[0]?.sellingPrice) || 0;
                          const quantity = Number(item?.quantity) || 0;
                          return sum + (sellingPrice * quantity);
                        }, 0) || 0), 0).toFixed(2)}
                    </Text>
                  </View>

                  <View className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Delivery Charges</Text>
                    <Text className="text-[16px] font-bold text-orange-600">
                      ₹{Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (Number(order?.deliveryCharge) || 0), 0).toFixed(2)}
                    </Text>
                  </View>

                  <View className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Discounts</Text>
                    <Text className="text-[16px] font-bold text-green-600">
                      ₹{Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (Number(order?.totalDiscount) || 0), 0).toFixed(2)}
                    </Text>
                  </View>

                  <View className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Avg. Order Value</Text>
                    <Text className="text-[16px] font-bold text-primary">
                      ₹{(Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (Number(order?.totalAmount) || 0), 0) / (Object.keys(ordersToSummarize).length || 1)).toFixed(2)}
                    </Text>
                  </View>
                </ScrollView>
              </>
            )}

            <ScrollView nestedScrollEnabled={true} horizontal={true}>
              <View style={{ flex: 1 }}>

                {/* Header Row */}
                <View className='flex-row bg-[#f0f0f0] sticky top-[0px] z-50 gap-[4px]'>
                  {/* SR. No */}
                  <Text className='text-center w-[40px] text-[12px] bg-black text-white py-[5px]' >SR no.</Text>
                  {/* Order Id */}
                  <Text className='text-center w-[165px] text-[12px] bg-black text-white py-[5px]' >Order Id</Text>
                  {/* Order Status */}
                  <View className='flex-row bg-black w-[130px] py-[5px] items-center justify-between px-[5px]'>
                    <Text className='text-center text-[12px] text-white'>
                      {selectedStatusFilters.length > 0 ? `${selectedStatusFilters.length} Selected` : 'Status'}
                    </Text>
                    <TouchableOpacity onPress={() => setIsStatusSortSelected(!isStatusSortSelected)}>
                      <Image source={require('@/assets/images/sortImage.png')} style={{ width: 15, height: 15 }} className='w-[20px] h-[20px]' />
                    </TouchableOpacity>
                    {selectedStatusFilters.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSelectedStatusFilters([])}
                        className="ml-1"
                      >
                        <Text className="text-white text-[10px] bg-primaryRed px-1 rounded">Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Items */}
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >
                    Items ({
                      vendorOrders
                        ?.filter((order) => {
                          // Status filter
                          const statusMatch = selectedStatusFilters.length > 0
                            ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                            : true;

                          // Delivery mode filter
                          let deliveryMatch = true;
                          if (selectedDeliveryFilters.length > 0) {
                            deliveryMatch = selectedDeliveryFilters.some(filter => {
                              if (filter === 'Home Delivery') {
                                return order?.deliveryMode === 'Home Delivery';
                              } else if (filter === 'Takeaway/Pickup') {
                                return order?.deliveryMode === 'Takeaway/Pickup';
                              } else if (filter.startsWith('QR:')) {
                                const qrMessage = filter.replace('QR:', '');
                                return order?.QRCodeMessage === qrMessage;
                              }
                              return false;
                            });
                          }

                          // Time filter
                          let timeMatch = true;
                          if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                            const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                            // Normalize orderDate to start of day for fair comparison
                            const orderDay = new Date(orderDate);
                            orderDay.setHours(0, 0, 0, 0);

                            const today = new Date();
                            today.setHours(0, 0, 0, 0); // Start of today

                            switch (selectedTimeFilter) {
                              case 'today':
                                timeMatch = orderDay.getTime() === today.getTime();
                                break;

                              case 'yesterday': {
                                const yesterday = new Date(today);
                                yesterday.setDate(yesterday.getDate() - 1);
                                timeMatch = orderDay.getTime() === yesterday.getTime();
                                break;
                              }

                              case 'last7days': {
                                const sevenDaysAgo = new Date(today);
                                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                                timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                                break;
                              }

                              case 'last15days': {
                                const fifteenDaysAgo = new Date(today);
                                fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                                timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                                break;
                              }

                              case 'last30days': {
                                const thirtyDaysAgo = new Date(today);
                                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                                timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                                break;
                              }

                              case 'last90days': {
                                const ninetyDaysAgo = new Date(today);
                                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                                timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                                break;
                              }

                              case 'last365days': {
                                const oneYearAgo = new Date(today);
                                oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                                timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                                break;
                              }

                              case 'custom': {
                                if (customStartDate && customEndDate) {
                                  const startOfRange = new Date(customStartDate);
                                  startOfRange.setHours(0, 0, 0, 0);

                                  const endOfRange = new Date(customEndDate);
                                  endOfRange.setHours(23, 59, 59, 999);

                                  timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                                }
                                break;
                              }

                              default:
                                timeMatch = true;
                            }
                          }

                          return statusMatch && deliveryMatch && timeMatch;
                        })
                        ?.reduce((total, order) => total + Number(order?.items?.reduce((innerTotal, item) => innerTotal + Number(item?.quantity), 0) || 0), 0) || 0
                    })
                  </Text>
                  {/* Delivery Modes */}
                  <View className='flex-row bg-black w-[150px] py-[5px] items-center justify-between px-[5px]'>
                    <Text className='text-center text-[12px] text-white'>
                      {selectedDeliveryFilters.length > 0 ? `${selectedDeliveryFilters.length} Selected` : 'Delivery Mode'}
                    </Text>
                    <TouchableOpacity onPress={() => setIsDeliverySortSelected(!isDeliverySortSelected)}>
                      <Image source={require('@/assets/images/sortImage.png')} style={{ width: 15, height: 15 }} className='w-[20px] h-[20px]' />
                    </TouchableOpacity>
                    {selectedDeliveryFilters.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSelectedDeliveryFilters([])}
                        className="ml-1"
                      >
                        <Text className="text-white text-[10px] bg-primaryRed px-1 rounded">Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Print */}
                  <Text className='text-center w-[40px] text-[12px] bg-black text-white py-[5px]' >Print</Text>
                  {/* Total */}
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Total: ₹{
                    vendorOrders
                      ?.filter((order) => {
                        // Status filter
                        const statusMatch = selectedStatusFilters.length > 0
                          ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                          : true;

                        // Delivery mode filter
                        let deliveryMatch = true;
                        if (selectedDeliveryFilters.length > 0) {
                          deliveryMatch = selectedDeliveryFilters.some(filter => {
                            if (filter === 'Home Delivery') {
                              return order?.deliveryMode === 'Home Delivery';
                            } else if (filter === 'Takeaway/Pickup') {
                              return order?.deliveryMode === 'Takeaway/Pickup';
                            } else if (filter.startsWith('QR:')) {
                              const qrMessage = filter.replace('QR:', '');
                              return order?.QRCodeMessage === qrMessage;
                            }
                            return false;
                          });
                        }

                        // Time filter
                        let timeMatch = true;
                        if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                          const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                          // Normalize orderDate to start of day for fair comparison
                          const orderDay = new Date(orderDate);
                          orderDay.setHours(0, 0, 0, 0);

                          const today = new Date();
                          today.setHours(0, 0, 0, 0); // Start of today

                          switch (selectedTimeFilter) {
                            case 'today':
                              timeMatch = orderDay.getTime() === today.getTime();
                              break;

                            case 'yesterday': {
                              const yesterday = new Date(today);
                              yesterday.setDate(yesterday.getDate() - 1);
                              timeMatch = orderDay.getTime() === yesterday.getTime();
                              break;
                            }

                            case 'last7days': {
                              const sevenDaysAgo = new Date(today);
                              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                              timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last15days': {
                              const fifteenDaysAgo = new Date(today);
                              fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                              timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last30days': {
                              const thirtyDaysAgo = new Date(today);
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                              timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last90days': {
                              const ninetyDaysAgo = new Date(today);
                              ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                              timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last365days': {
                              const oneYearAgo = new Date(today);
                              oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                              timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                              break;
                            }

                            case 'custom': {
                              if (customStartDate && customEndDate) {
                                const startOfRange = new Date(customStartDate);
                                startOfRange.setHours(0, 0, 0, 0);

                                const endOfRange = new Date(customEndDate);
                                endOfRange.setHours(23, 59, 59, 999);

                                timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                              }
                              break;
                            }

                            default:
                              timeMatch = true;
                          }
                        }

                        return statusMatch && deliveryMatch && timeMatch;
                      }).reduce((total, order) => total + Number(order?.totalAmount), 0)?.toFixed(2)
                  }</Text>
                  {/* Sub Total */}
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Sub Total: ₹{
                    vendorOrders
                      ?.filter((order) => {
                        // Status filter
                        const statusMatch = selectedStatusFilters.length > 0
                          ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                          : true;

                        // Delivery mode filter
                        let deliveryMatch = true;
                        if (selectedDeliveryFilters.length > 0) {
                          deliveryMatch = selectedDeliveryFilters.some(filter => {
                            if (filter === 'Home Delivery') {
                              return order?.deliveryMode === 'Home Delivery';
                            } else if (filter === 'Takeaway/Pickup') {
                              return order?.deliveryMode === 'Takeaway/Pickup';
                            } else if (filter.startsWith('QR:')) {
                              const qrMessage = filter.replace('QR:', '');
                              return order?.QRCodeMessage === qrMessage;
                            }
                            return false;
                          });
                        }

                        // Time filter
                        let timeMatch = true;
                        if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                          const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                          // Normalize orderDate to start of day for fair comparison
                          const orderDay = new Date(orderDate);
                          orderDay.setHours(0, 0, 0, 0);

                          const today = new Date();
                          today.setHours(0, 0, 0, 0); // Start of today

                          switch (selectedTimeFilter) {
                            case 'today':
                              timeMatch = orderDay.getTime() === today.getTime();
                              break;

                            case 'yesterday': {
                              const yesterday = new Date(today);
                              yesterday.setDate(yesterday.getDate() - 1);
                              timeMatch = orderDay.getTime() === yesterday.getTime();
                              break;
                            }

                            case 'last7days': {
                              const sevenDaysAgo = new Date(today);
                              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                              timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last15days': {
                              const fifteenDaysAgo = new Date(today);
                              fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                              timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last30days': {
                              const thirtyDaysAgo = new Date(today);
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                              timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last90days': {
                              const ninetyDaysAgo = new Date(today);
                              ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                              timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last365days': {
                              const oneYearAgo = new Date(today);
                              oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                              timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                              break;
                            }

                            case 'custom': {
                              if (customStartDate && customEndDate) {
                                const startOfRange = new Date(customStartDate);
                                startOfRange.setHours(0, 0, 0, 0);

                                const endOfRange = new Date(customEndDate);
                                endOfRange.setHours(23, 59, 59, 999);

                                timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                              }
                              break;
                            }

                            default:
                              timeMatch = true;
                          }
                        }

                        return statusMatch && deliveryMatch && timeMatch;
                      }).reduce((total, order) => total + Number(order?.items?.reduce((innerTotal, item) => innerTotal + Number(item?.quantity * Number(item?.price?.[0]?.sellingPrice)), 0)), 0)?.toFixed(2)
                  }</Text>
                  {/* Delivery Charge */}
                  <Text className='text-center w-[100px] text-[12px] bg-black text-white py-[5px]' >Delivery Charge: ₹{
                    vendorOrders
                      ?.filter((order) => {
                        // Status filter
                        const statusMatch = selectedStatusFilters.length > 0
                          ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                          : true;

                        // Delivery mode filter
                        let deliveryMatch = true;
                        if (selectedDeliveryFilters.length > 0) {
                          deliveryMatch = selectedDeliveryFilters.some(filter => {
                            if (filter === 'Home Delivery') {
                              return order?.deliveryMode === 'Home Delivery';
                            } else if (filter === 'Takeaway/Pickup') {
                              return order?.deliveryMode === 'Takeaway/Pickup';
                            } else if (filter.startsWith('QR:')) {
                              const qrMessage = filter.replace('QR:', '');
                              return order?.QRCodeMessage === qrMessage;
                            }
                            return false;
                          });
                        }

                        // Time filter
                        let timeMatch = true;
                        if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                          const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                          // Normalize orderDate to start of day for fair comparison
                          const orderDay = new Date(orderDate);
                          orderDay.setHours(0, 0, 0, 0);

                          const today = new Date();
                          today.setHours(0, 0, 0, 0); // Start of today

                          switch (selectedTimeFilter) {
                            case 'today':
                              timeMatch = orderDay.getTime() === today.getTime();
                              break;

                            case 'yesterday': {
                              const yesterday = new Date(today);
                              yesterday.setDate(yesterday.getDate() - 1);
                              timeMatch = orderDay.getTime() === yesterday.getTime();
                              break;
                            }

                            case 'last7days': {
                              const sevenDaysAgo = new Date(today);
                              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                              timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last15days': {
                              const fifteenDaysAgo = new Date(today);
                              fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                              timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last30days': {
                              const thirtyDaysAgo = new Date(today);
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                              timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last90days': {
                              const ninetyDaysAgo = new Date(today);
                              ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                              timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last365days': {
                              const oneYearAgo = new Date(today);
                              oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                              timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                              break;
                            }

                            case 'custom': {
                              if (customStartDate && customEndDate) {
                                const startOfRange = new Date(customStartDate);
                                startOfRange.setHours(0, 0, 0, 0);

                                const endOfRange = new Date(customEndDate);
                                endOfRange.setHours(23, 59, 59, 999);

                                timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                              }
                              break;
                            }

                            default:
                              timeMatch = true;
                          }
                        }

                        return statusMatch && deliveryMatch && timeMatch;
                      }).reduce((total, order) => total + Number(order?.deliveryCharge || 0), 0)?.toFixed(2)
                  }</Text>
                  {/* Offer */}
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Offer: ₹{
                    vendorOrders
                      ?.filter((order) => {
                        // Status filter
                        const statusMatch = selectedStatusFilters.length > 0
                          ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                          : true;

                        // Delivery mode filter
                        let deliveryMatch = true;
                        if (selectedDeliveryFilters.length > 0) {
                          deliveryMatch = selectedDeliveryFilters.some(filter => {
                            if (filter === 'Home Delivery') {
                              return order?.deliveryMode === 'Home Delivery';
                            } else if (filter === 'Takeaway/Pickup') {
                              return order?.deliveryMode === 'Takeaway/Pickup';
                            } else if (filter.startsWith('QR:')) {
                              const qrMessage = filter.replace('QR:', '');
                              return order?.QRCodeMessage === qrMessage;
                            }
                            return false;
                          });
                        }

                        // Time filter
                        let timeMatch = true;
                        if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                          const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                          // Normalize orderDate to start of day for fair comparison
                          const orderDay = new Date(orderDate);
                          orderDay.setHours(0, 0, 0, 0);

                          const today = new Date();
                          today.setHours(0, 0, 0, 0); // Start of today

                          switch (selectedTimeFilter) {
                            case 'today':
                              timeMatch = orderDay.getTime() === today.getTime();
                              break;

                            case 'yesterday': {
                              const yesterday = new Date(today);
                              yesterday.setDate(yesterday.getDate() - 1);
                              timeMatch = orderDay.getTime() === yesterday.getTime();
                              break;
                            }

                            case 'last7days': {
                              const sevenDaysAgo = new Date(today);
                              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                              timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last15days': {
                              const fifteenDaysAgo = new Date(today);
                              fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                              timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last30days': {
                              const thirtyDaysAgo = new Date(today);
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                              timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last90days': {
                              const ninetyDaysAgo = new Date(today);
                              ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                              timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                              break;
                            }

                            case 'last365days': {
                              const oneYearAgo = new Date(today);
                              oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                              timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                              break;
                            }

                            case 'custom': {
                              if (customStartDate && customEndDate) {
                                const startOfRange = new Date(customStartDate);
                                startOfRange.setHours(0, 0, 0, 0);

                                const endOfRange = new Date(customEndDate);
                                endOfRange.setHours(23, 59, 59, 999);

                                timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                              }
                              break;
                            }

                            default:
                              timeMatch = true;
                          }
                        }

                        return statusMatch && deliveryMatch && timeMatch;
                      }).reduce((total, order) => total + Number(order?.totalDiscount), 0)?.toFixed(2)
                  }</Text>
                  {/* Order Time */}
                  <View className='flex-row bg-black w-[130px] py-[5px] items-center justify-between px-[5px]'>
                    <Text className='text-center text-[12px] text-white'>
                      {selectedTimeFilter === 'custom' ? 'Custom Range' : 'Time'}
                    </Text>
                    <TouchableOpacity onPress={() => setIsTimeSortSelected(!isTimeSortSelected)}>
                      <Image source={require('@/assets/images/sortImage.png')} style={{ width: 15, height: 15 }} className='w-[20px] h-[20px]' />
                    </TouchableOpacity>
                    {selectedTimeFilter && (
                      <TouchableOpacity
                        onPress={() => setSelectedTimeFilter(null)}
                        className="ml-1"
                      >
                        <Text className="text-white text-[10px] bg-primaryRed px-1 rounded">Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Customer Name */}
                  <Text className='text-center w-[130px] text-[12px] bg-black text-white py-[5px]' >Customer Name</Text>
                  {/* Customer Mobile Number */}
                  <Text className='text-center w-[130px] text-[12px] bg-black text-white py-[5px]' >Customer Mob.</Text>
                  {/* Customer Address */}
                  <Text className='text-center w-[600px] text-[12px] bg-black text-white py-[5px]' >Customer Address</Text>
                </View>

                {/* Delivery Mode Filter Dropdown */}
                {isDeliverySortSelected && (
                  <View className="bg-white border border-gray-300 rounded-[5px] max-h-[350px] max-w-fit absolute top-[40px] left-[430px] z-50 shadow-md">
                    {/* Apply/Clear Buttons */}
                    <View className="flex-row border-t border-gray-300">
                      <TouchableOpacity
                        onPress={() => setIsDeliverySortSelected(false)}
                        className="flex-1 p-2 bg-primaryGreen"
                      >
                        <Text className="text-white text-center font-bold">Apply</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedDeliveryFilters([]);
                          setIsDeliverySortSelected(false);
                        }}
                        className="flex-1 p-2 bg-primaryRed"
                      >
                        <Text className="text-white text-center font-bold">Clear All</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView nestedScrollEnabled={true}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedDeliveryFilters([])
                          setIsDeliverySortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedDeliveryFilters.length === 0 ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedDeliveryFilters.length === 0 ? 'text-white' : ''}`}>All <Text className='bg-black text-white py-[1px] px-[5px] rounded-[3px]' >{
                          vendorOrders
                            ?.filter((order) => {
                              // Status filter
                              const statusMatch = selectedStatusFilters.length > 0
                                ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                                : true;

                              // Time filter
                              let timeMatch = true;
                              if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                                const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                                // Normalize orderDate to start of day for fair comparison
                                const orderDay = new Date(orderDate);
                                orderDay.setHours(0, 0, 0, 0);

                                const today = new Date();
                                today.setHours(0, 0, 0, 0); // Start of today

                                switch (selectedTimeFilter) {
                                  case 'today':
                                    timeMatch = orderDay.getTime() === today.getTime();
                                    break;

                                  case 'yesterday': {
                                    const yesterday = new Date(today);
                                    yesterday.setDate(yesterday.getDate() - 1);
                                    timeMatch = orderDay.getTime() === yesterday.getTime();
                                    break;
                                  }

                                  case 'last7days': {
                                    const sevenDaysAgo = new Date(today);
                                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                                    timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                                    break;
                                  }

                                  case 'last15days': {
                                    const fifteenDaysAgo = new Date(today);
                                    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                                    timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                                    break;
                                  }

                                  case 'last30days': {
                                    const thirtyDaysAgo = new Date(today);
                                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                                    timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                                    break;
                                  }

                                  case 'last90days': {
                                    const ninetyDaysAgo = new Date(today);
                                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                                    timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                                    break;
                                  }

                                  case 'last365days': {
                                    const oneYearAgo = new Date(today);
                                    oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                                    timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                                    break;
                                  }

                                  case 'custom': {
                                    if (customStartDate && customEndDate) {
                                      const startOfRange = new Date(customStartDate);
                                      startOfRange.setHours(0, 0, 0, 0);

                                      const endOfRange = new Date(customEndDate);
                                      endOfRange.setHours(23, 59, 59, 999);

                                      timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                                    }
                                    break;
                                  }

                                  default:
                                    timeMatch = true;
                                }
                              }

                              return statusMatch && timeMatch;
                            })?.length
                        }</Text>
                        </Text>
                      </TouchableOpacity>

                      {/* Home Delivery */}
                      <TouchableOpacity
                        onPress={() => {
                          const filter = 'Home Delivery';
                          setSelectedDeliveryFilters(prev =>
                            prev.includes(filter)
                              ? prev.filter(f => f !== filter)
                              : [...prev, filter]
                          );
                        }}
                        className={`p-2 border-b border-gray-200 flex-row items-center ${selectedDeliveryFilters.includes('Home Delivery') ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center flex-1 ${selectedDeliveryFilters.includes('Home Delivery') ? 'text-white' : 'text-primaryGreen'}`}>
                          Home Delivery <Text className='bg-black text-white py-[1px] px-[5px] rounded-[3px]' >{
                            vendorOrders
                              ?.filter((order) => {
                                // Status filter
                                const statusMatch = selectedStatusFilters.length > 0
                                  ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                                  : true;

                                // Time filter
                                let timeMatch = true;
                                if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                                  const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                                  // Normalize orderDate to start of day for fair comparison
                                  const orderDay = new Date(orderDate);
                                  orderDay.setHours(0, 0, 0, 0);

                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0); // Start of today

                                  switch (selectedTimeFilter) {
                                    case 'today':
                                      timeMatch = orderDay.getTime() === today.getTime();
                                      break;

                                    case 'yesterday': {
                                      const yesterday = new Date(today);
                                      yesterday.setDate(yesterday.getDate() - 1);
                                      timeMatch = orderDay.getTime() === yesterday.getTime();
                                      break;
                                    }

                                    case 'last7days': {
                                      const sevenDaysAgo = new Date(today);
                                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                                      timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last15days': {
                                      const fifteenDaysAgo = new Date(today);
                                      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                                      timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last30days': {
                                      const thirtyDaysAgo = new Date(today);
                                      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                                      timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last90days': {
                                      const ninetyDaysAgo = new Date(today);
                                      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                                      timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last365days': {
                                      const oneYearAgo = new Date(today);
                                      oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                                      timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'custom': {
                                      if (customStartDate && customEndDate) {
                                        const startOfRange = new Date(customStartDate);
                                        startOfRange.setHours(0, 0, 0, 0);

                                        const endOfRange = new Date(customEndDate);
                                        endOfRange.setHours(23, 59, 59, 999);

                                        timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                                      }
                                      break;
                                    }

                                    default:
                                      timeMatch = true;
                                  }
                                }

                                return statusMatch && timeMatch;
                              })?.filter((order) => order?.deliveryMode === 'Home Delivery')?.length
                          }</Text>
                        </Text>
                        {selectedDeliveryFilters.includes('Home Delivery') && (
                          <Text className="text-white ml-2">✓</Text>
                        )}
                      </TouchableOpacity>

                      {/* Takeaway/Pickup */}
                      <TouchableOpacity
                        onPress={() => {
                          const filter = 'Takeaway/Pickup';
                          setSelectedDeliveryFilters(prev =>
                            prev.includes(filter)
                              ? prev.filter(f => f !== filter)
                              : [...prev, filter]
                          );
                        }}
                        className={`p-2 border-b border-gray-200 flex-row items-center ${selectedDeliveryFilters.includes('Takeaway/Pickup') ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center flex-1 ${selectedDeliveryFilters.includes('Takeaway/Pickup') ? 'text-white' : 'text-primaryRed'}`}>
                          Takeaway/Pickup <Text className='bg-black text-white py-[1px] px-[5px] rounded-[3px]' >{
                            vendorOrders
                              ?.filter((order) => {
                                // Status filter
                                const statusMatch = selectedStatusFilters.length > 0
                                  ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                                  : true;

                                // Time filter
                                let timeMatch = true;
                                if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                                  const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                                  // Normalize orderDate to start of day for fair comparison
                                  const orderDay = new Date(orderDate);
                                  orderDay.setHours(0, 0, 0, 0);

                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0); // Start of today

                                  switch (selectedTimeFilter) {
                                    case 'today':
                                      timeMatch = orderDay.getTime() === today.getTime();
                                      break;

                                    case 'yesterday': {
                                      const yesterday = new Date(today);
                                      yesterday.setDate(yesterday.getDate() - 1);
                                      timeMatch = orderDay.getTime() === yesterday.getTime();
                                      break;
                                    }

                                    case 'last7days': {
                                      const sevenDaysAgo = new Date(today);
                                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                                      timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last15days': {
                                      const fifteenDaysAgo = new Date(today);
                                      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                                      timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last30days': {
                                      const thirtyDaysAgo = new Date(today);
                                      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                                      timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last90days': {
                                      const ninetyDaysAgo = new Date(today);
                                      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                                      timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last365days': {
                                      const oneYearAgo = new Date(today);
                                      oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                                      timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'custom': {
                                      if (customStartDate && customEndDate) {
                                        const startOfRange = new Date(customStartDate);
                                        startOfRange.setHours(0, 0, 0, 0);

                                        const endOfRange = new Date(customEndDate);
                                        endOfRange.setHours(23, 59, 59, 999);

                                        timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                                      }
                                      break;
                                    }

                                    default:
                                      timeMatch = true;
                                  }
                                }

                                return statusMatch && timeMatch;
                              })?.filter((order) => order?.deliveryMode === 'Takeaway/Pickup')?.length
                          }</Text>
                        </Text>
                        {selectedDeliveryFilters.includes('Takeaway/Pickup') && (
                          <Text className="text-white ml-2">✓</Text>
                        )}
                      </TouchableOpacity>

                      {/* QR Codes (Unique) */}
                      {(() => {
                        const uniqueQRCodes = [...new Set(vendorOrders.filter((order) => selectedOrderStatus === 'Pending' ? order?.orderStatus === 'Pending' : selectedOrderStatus === 'Approved' ? order?.orderStatus === 'Approved' : selectedOrderStatus === 'Rejected' ? order?.orderStatus === 'Rejected' : true)
                          .filter(order => order.QRCodeMessage)
                          .map(order => order.QRCodeMessage)
                        )]

                        return uniqueQRCodes.map((qrMessage, index) => {
                          const filter = `QR:${qrMessage}`;
                          return (
                            <TouchableOpacity
                              key={index}
                              onPress={() => {
                                setSelectedDeliveryFilters(prev =>
                                  prev.includes(filter)
                                    ? prev.filter(f => f !== filter)
                                    : [...prev, filter]
                                );
                              }}
                              className={`p-2 border-b border-gray-200 flex-row items-center ${selectedDeliveryFilters.includes(filter) ? 'bg-primary' : ''}`}
                            >
                              <Text className={`text-center flex-1 ${selectedDeliveryFilters.includes(filter) ? 'text-white' : ''}`}>
                                QR: {qrMessage} <Text className='bg-black text-white py-[1px] px-[5px] rounded-[3px]' >{
                                  vendorOrders
                                    ?.filter((order) => {
                                      // Status filter
                                      const statusMatch = selectedStatusFilters.length > 0
                                        ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                                        : true;

                                      // Time filter
                                      let timeMatch = true;
                                      if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                                        const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                                        // Normalize orderDate to start of day for fair comparison
                                        const orderDay = new Date(orderDate);
                                        orderDay.setHours(0, 0, 0, 0);

                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0); // Start of today

                                        switch (selectedTimeFilter) {
                                          case 'today':
                                            timeMatch = orderDay.getTime() === today.getTime();
                                            break;

                                          case 'yesterday': {
                                            const yesterday = new Date(today);
                                            yesterday.setDate(yesterday.getDate() - 1);
                                            timeMatch = orderDay.getTime() === yesterday.getTime();
                                            break;
                                          }

                                          case 'last7days': {
                                            const sevenDaysAgo = new Date(today);
                                            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                                            timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                                            break;
                                          }

                                          case 'last15days': {
                                            const fifteenDaysAgo = new Date(today);
                                            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                                            timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                                            break;
                                          }

                                          case 'last30days': {
                                            const thirtyDaysAgo = new Date(today);
                                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                                            timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                                            break;
                                          }

                                          case 'last90days': {
                                            const ninetyDaysAgo = new Date(today);
                                            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                                            timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                                            break;
                                          }

                                          case 'last365days': {
                                            const oneYearAgo = new Date(today);
                                            oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                                            timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                                            break;
                                          }

                                          case 'custom': {
                                            if (customStartDate && customEndDate) {
                                              const startOfRange = new Date(customStartDate);
                                              startOfRange.setHours(0, 0, 0, 0);

                                              const endOfRange = new Date(customEndDate);
                                              endOfRange.setHours(23, 59, 59, 999);

                                              timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                                            }
                                            break;
                                          }

                                          default:
                                            timeMatch = true;
                                        }
                                      }

                                      return statusMatch && timeMatch;
                                    })?.filter((order) => order?.QRCodeMessage === qrMessage)?.length
                                }</Text>
                              </Text>
                              {selectedDeliveryFilters.includes(filter) && (
                                <Text className="text-white ml-2">✓</Text>
                              )}
                            </TouchableOpacity>
                          )
                        })
                      })()}
                    </ScrollView>
                  </View>
                )}

                {/* Time Filter Dropdown */}
                {isTimeSortSelected && (
                  <View className="bg-white border border-gray-300 max-h-[350px] max-w-fit absolute top-[40px] left-[984px] z-50 shadow-md">
                    <ScrollView nestedScrollEnabled={true}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter(null)
                          setIsTimeSortSelected(false)
                        }}
                        className="p-2 border-b border-gray-200"
                      >
                        <Text className="text-center">All Time</Text>
                      </TouchableOpacity>

                      {/* Today */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter('today')
                          setIsTimeSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedTimeFilter === 'today' ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedTimeFilter === 'today' ? 'text-white' : ''}`}>Today</Text>
                      </TouchableOpacity>

                      {/* Yesterday */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter('yesterday')
                          setIsTimeSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedTimeFilter === 'yesterday' ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedTimeFilter === 'yesterday' ? 'text-white' : ''}`}>Yesterday</Text>
                      </TouchableOpacity>

                      {/* Last 7 Days */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter('last7days')
                          setIsTimeSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedTimeFilter === 'last7days' ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedTimeFilter === 'last7days' ? 'text-white' : ''}`}>Last 7 Days</Text>
                      </TouchableOpacity>

                      {/* Last 15 Days */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter('last15days')
                          setIsTimeSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedTimeFilter === 'last15days' ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedTimeFilter === 'last15days' ? 'text-white' : ''}`}>Last 15 Days</Text>
                      </TouchableOpacity>

                      {/* Last 30 Days */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter('last30days')
                          setIsTimeSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedTimeFilter === 'last30days' ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedTimeFilter === 'last30days' ? 'text-white' : ''}`}>Last 30 Days</Text>
                      </TouchableOpacity>

                      {/* Last 90 Days */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter('last90days')
                          setIsTimeSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedTimeFilter === 'last90days' ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedTimeFilter === 'last90days' ? 'text-white' : ''}`}>Last 90 Days</Text>
                      </TouchableOpacity>

                      {/* Last 365 Days */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTimeFilter('last365days')
                          setIsTimeSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedTimeFilter === 'last365days' ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedTimeFilter === 'last365days' ? 'text-white' : ''}`}>Last 365 Days</Text>
                      </TouchableOpacity>

                      {/* Custom Range */}
                      <TouchableOpacity
                        onPress={() => {
                          setIsCustomRangeModalVisible(true)
                          setIsTimeSortSelected(false)
                        }}
                        className="p-2 border-b border-gray-200 bg-[#ccc]"
                      >
                        <Text className="text-center font-bold">Custom Range</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                )}

                {/* Status Filter Dropdown */}
                {isStatusSortSelected && (
                  <View className="bg-white border border-gray-300 max-h-[350px] max-w-fit absolute top-[40px] left-[217px] z-50 shadow-md">
                    {/* Apply/Clear Buttons */}
                    <View className="flex-row border-t border-gray-300">
                      <TouchableOpacity
                        onPress={() => setIsStatusSortSelected(false)}
                        className="flex-1 p-2 bg-primaryGreen"
                      >
                        <Text className="text-white text-center font-bold">Apply</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedStatusFilters([]);
                          setIsStatusSortSelected(false);
                        }}
                        className="flex-1 p-2 bg-primaryRed"
                      >
                        <Text className="text-white text-center font-bold">Clear All</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView nestedScrollEnabled={true}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedStatusFilters([])
                          setIsStatusSortSelected(false)
                        }}
                        className={`p-2 border-b border-gray-200 ${selectedStatusFilters.length === 0 ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center ${selectedStatusFilters.length === 0 ? 'text-white' : ''}`}>All ({vendorOrders?.length})</Text>
                      </TouchableOpacity>

                      {/* Pending */}
                      <TouchableOpacity
                        onPress={() => {
                          const filter = 'Pending';
                          setSelectedStatusFilters(prev =>
                            prev.includes(filter)
                              ? prev.filter(f => f !== filter)
                              : [...prev, filter]
                          );
                        }}
                        className={`p-2 border-b border-gray-200 flex-row items-center ${selectedStatusFilters.includes('Pending') ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center flex-1 ${selectedStatusFilters.includes('Pending') ? 'text-white' : 'text-yellow-600'}`}>
                          Pending ({vendorOrders?.filter((order) => order?.orderStatus === 'Pending')?.length})
                        </Text>
                        {selectedStatusFilters.includes('Pending') && (
                          <Text className="text-white ml-2">✓</Text>
                        )}
                      </TouchableOpacity>

                      {/* Approved */}
                      <TouchableOpacity
                        onPress={() => {
                          const filter = 'Approved';
                          setSelectedStatusFilters(prev =>
                            prev.includes(filter)
                              ? prev.filter(f => f !== filter)
                              : [...prev, filter]
                          );
                        }}
                        className={`p-2 border-b border-gray-200 flex-row items-center ${selectedStatusFilters.includes('Approved') ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center flex-1 ${selectedStatusFilters.includes('Approved') ? 'text-white' : 'text-primaryGreen'}`}>
                          Approved ({vendorOrders?.filter((order) => order?.orderStatus === 'Approved')?.length})
                        </Text>
                        {selectedStatusFilters.includes('Approved') && (
                          <Text className="text-white ml-2">✓</Text>
                        )}
                      </TouchableOpacity>

                      {/* Rejected */}
                      <TouchableOpacity
                        onPress={() => {
                          const filter = 'Rejected';
                          setSelectedStatusFilters(prev =>
                            prev.includes(filter)
                              ? prev.filter(f => f !== filter)
                              : [...prev, filter]
                          );
                        }}
                        className={`p-2 border-b border-gray-200 flex-row items-center ${selectedStatusFilters.includes('Rejected') ? 'bg-primary' : ''}`}
                      >
                        <Text className={`text-center flex-1 ${selectedStatusFilters.includes('Rejected') ? 'text-white' : 'text-primaryRed'}`}>
                          Rejected ({vendorOrders?.filter((order) => order?.orderStatus === 'Rejected')?.length})
                        </Text>
                        {selectedStatusFilters.includes('Rejected') && (
                          <Text className="text-white ml-2">✓</Text>
                        )}
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                )}

                {/* Data Rows */}
                <ScrollView nestedScrollEnabled={true} style={{ height: Object.keys(ordersToSummarize).length > 0 ? 'calc(100vh - 300px)' : 'calc(100vh - 210px)' }} >
                  {vendorOrders
                    ?.filter((order) => {
                      // Status filter
                      const statusMatch = selectedStatusFilters.length > 0
                        ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                        : true;

                      // Delivery mode filter
                      let deliveryMatch = true
                      if (selectedDeliveryFilters.length > 0) {
                        deliveryMatch = selectedDeliveryFilters.some(filter => {
                          if (filter === 'Home Delivery') {
                            return order?.deliveryMode === 'Home Delivery'
                          } else if (filter === 'Takeaway/Pickup') {
                            return order?.deliveryMode === 'Takeaway/Pickup'
                          } else if (filter.startsWith('QR:')) {
                            const qrMessage = filter.replace('QR:', '')
                            return order?.QRCodeMessage === qrMessage
                          }
                          return false
                        })
                      }

                      // Time filter
                      let timeMatch = true;
                      if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                        const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                        // Normalize orderDate to start of day for fair comparison
                        const orderDay = new Date(orderDate);
                        orderDay.setHours(0, 0, 0, 0);

                        const today = new Date();
                        today.setHours(0, 0, 0, 0); // Start of today

                        switch (selectedTimeFilter) {
                          case 'today':
                            timeMatch = orderDay.getTime() === today.getTime();
                            break;

                          case 'yesterday': {
                            const yesterday = new Date(today);
                            yesterday.setDate(yesterday.getDate() - 1);
                            timeMatch = orderDay.getTime() === yesterday.getTime();
                            break;
                          }

                          case 'last7days': {
                            const sevenDaysAgo = new Date(today);
                            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                            timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                            break;
                          }

                          case 'last15days': {
                            const fifteenDaysAgo = new Date(today);
                            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                            timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                            break;
                          }

                          case 'last30days': {
                            const thirtyDaysAgo = new Date(today);
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                            timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                            break;
                          }

                          case 'last90days': {
                            const ninetyDaysAgo = new Date(today);
                            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                            timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                            break;
                          }

                          case 'last365days': {
                            const oneYearAgo = new Date(today);
                            oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                            timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                            break;
                          }

                          case 'custom': {
                            if (customStartDate && customEndDate) {
                              const startOfRange = new Date(customStartDate);
                              startOfRange.setHours(0, 0, 0, 0);

                              const endOfRange = new Date(customEndDate);
                              endOfRange.setHours(23, 59, 59, 999);

                              timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                            }
                            break;
                          }

                          default:
                            timeMatch = true;
                        }
                      }

                      return statusMatch && deliveryMatch && timeMatch
                    }).map((order, index) => (
                      <View key={order.id} className={`flex-row gap-[4px] py-1 border-b border-gray-200 ${ordersToSummarize[order.id] ? 'bg-blue-100' : ''}`}>
                        {/* SR. No */}
                        <TouchableOpacity className={`${Object.values(ordersToSummarize)?.filter((innerOrder) => innerOrder?.id === order?.id)?.length > 0 ? 'bg-primary' : ''}`} onPress={() => setOrdersToSummarize(prev => prev[order.id] ? (() => { const { [order.id]: removed, ...rest } = prev; return rest; })() : { ...prev, [order.id]: order })}>
                          <Text className={`text-center w-[40px] text-[12px] py-[5px] ${Object.values(ordersToSummarize)?.filter((innerOrder) => innerOrder?.id === order?.id)?.length > 0 ? 'text-white' : ''}`}>
                            {(() => {
                              const filteredOrders = vendorOrders?.filter((order) => {
                                // Status filter
                                const statusMatch = selectedStatusFilters.length > 0
                                  ? selectedStatusFilters.includes(order?.orderStatus || 'Pending')
                                  : true;

                                // Delivery mode filter
                                let deliveryMatch = true;
                                if (selectedDeliveryFilters.length > 0) {
                                  deliveryMatch = selectedDeliveryFilters.some(filter => {
                                    if (filter === 'Home Delivery') {
                                      return order?.deliveryMode === 'Home Delivery';
                                    } else if (filter === 'Takeaway/Pickup') {
                                      return order?.deliveryMode === 'Takeaway/Pickup';
                                    } else if (filter.startsWith('QR:')) {
                                      const qrMessage = filter.replace('QR:', '');
                                      return order?.QRCodeMessage === qrMessage;
                                    }
                                    return false;
                                  });
                                }

                                // Time filter - MUST MATCH THE MAIN FILTER EXACTLY
                                let timeMatch = true;
                                if (selectedTimeFilter && selectedTimeFilter !== 'all') {
                                  const orderDate = order?.orderTime?.toDate?.() || new Date(order?.timestamp || 0);

                                  // Normalize orderDate to start of day for fair comparison
                                  const orderDay = new Date(orderDate);
                                  orderDay.setHours(0, 0, 0, 0);

                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0); // Start of today

                                  switch (selectedTimeFilter) {
                                    case 'today':
                                      timeMatch = orderDay.getTime() === today.getTime();
                                      break;

                                    case 'yesterday': {
                                      const yesterday = new Date(today);
                                      yesterday.setDate(yesterday.getDate() - 1);
                                      timeMatch = orderDay.getTime() === yesterday.getTime();
                                      break;
                                    }

                                    case 'last7days': {
                                      const sevenDaysAgo = new Date(today);
                                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total including today
                                      timeMatch = orderDay >= sevenDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last15days': {
                                      const fifteenDaysAgo = new Date(today);
                                      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14); // 15 days total
                                      timeMatch = orderDay >= fifteenDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last30days': {
                                      const thirtyDaysAgo = new Date(today);
                                      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days total
                                      timeMatch = orderDay >= thirtyDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last90days': {
                                      const ninetyDaysAgo = new Date(today);
                                      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
                                      timeMatch = orderDay >= ninetyDaysAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'last365days': {
                                      const oneYearAgo = new Date(today);
                                      oneYearAgo.setDate(oneYearAgo.getDate() - 364); // 365 days total
                                      timeMatch = orderDay >= oneYearAgo && orderDay <= today;
                                      break;
                                    }

                                    case 'custom': {
                                      if (customStartDate && customEndDate) {
                                        const startOfRange = new Date(customStartDate);
                                        startOfRange.setHours(0, 0, 0, 0);

                                        const endOfRange = new Date(customEndDate);
                                        endOfRange.setHours(23, 59, 59, 999);

                                        timeMatch = orderDate >= startOfRange && orderDate <= endOfRange;
                                      }
                                      break;
                                    }

                                    default:
                                      timeMatch = true;
                                  }
                                }

                                return statusMatch && deliveryMatch && timeMatch;
                              });

                              // Return the correct serial number (total filtered count - current index)
                              return (filteredOrders?.length || 0) - index;
                            })()}
                          </Text>
                        </TouchableOpacity>
                        {/* Order Id */}
                        <Text className='text-center w-[165px] text-[12px] py-[5px]'>{order?.id}</Text>
                        {/* Order Status */}
                        {order?.orderStatus === 'Pending' ? (
                          <View className='flex-row w-[130px]' >
                            <TouchableOpacity onPress={() => { setOrderForAction(order); handleApproveOrder(order) }} className='flex-1 rounded-l-[5px] bg-primaryGreen items-center justify-center' ><Text className='text-center text-white text-[10px]' >Approve</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => { setOrderForAction(order); handleRejectOrder(order) }} className='flex-1 bg-primaryRed items-center justify-center' ><Text className='text-center text-white text-[10px]' >Reject</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                              setOrderForAction(order)
                              setIsEditOrderModalVisible(true);
                              // Initialize editing states with current values
                              const initialQtys = {};
                              const initialPrices = {};
                              order.items?.forEach(item => {
                                initialQtys[item.id] = Number(item?.quantity);
                                initialPrices[item.id] = Number(item?.price?.[0]?.sellingPrice);
                              });
                              setNewQtysForEditingOrder(initialQtys);
                              setNewSellingPricesForEditingOrder(initialPrices);
                            }} className='flex-1 rounded-r-[5px] bg-primaryYellow items-center justify-center' ><Text className='text-center text-[10px]' >Edit</Text></TouchableOpacity>
                          </View>
                        ) : (
                          <Text className={`text-center w-[130px] text-[12px] py-[5px] ${order?.orderStatus === 'Pending' ? 'bg-primaryYellow' : order?.orderStatus === 'Approved' ? 'bg-primaryGreen text-white' : 'bg-primaryRed text-white'}`}>{order?.orderStatus || 'Pending'}</Text>
                        )}
                        {/* Order Items */}
                        <TouchableOpacity onPress={() => { setOrderToShowItemsFor(order); setIsSelectedOrderItemsListModalVisible(true) }}>
                          <Text className='text-center w-[80px] text-[12px] py-[5px]'>{order?.items?.reduce((total, item) => { const quantity = Number(item?.quantity) || 0; return total + quantity; }, 0) || '0'}</Text>
                        </TouchableOpacity>
                        {/* Delivery Mode */}
                        <Text className={`text-center w-[150px] text-[12px] py-[5px] ${order?.deliveryMode === 'Takeaway/Pickup' ? 'text-primaryRed' : order?.deliveryMode === 'Home Delivery' ? 'text-primaryGreen' : ''}`}>{order?.deliveryMode || `QR: (${order?.QRCodeMessage})`}</Text>
                        {/* Print */}
                        <TouchableOpacity onPress={() => { setOrderForPrinting(order); setIsPrintingModalVisible(true) }} className='w-[40px] items-center justify-center'>
                          <Image style={{ height: 22, width: 22 }} source={require('@/assets/images/printImage.png')} />
                        </TouchableOpacity>
                        {/* Total Amount */}
                        <Text className='text-center w-[80px] text-[12px] py-[5px]'>₹{Number(order?.totalAmount).toFixed(2) || '0'}</Text>
                        {/* Sub Total */}
                        <Text className='text-center w-[80px] text-[12px] py-[5px]'>₹{order?.items?.reduce((total, item) => { const sellingPrice = Number(item?.price?.[0]?.sellingPrice) || 0; const quantity = Number(item?.quantity) || 0; return total + (sellingPrice * quantity); }, 0).toFixed(2) || '0'}</Text>
                        {/* Delivery Charge */}
                        <Text className={`text-center w-[100px] text-[12px] py-[5px] ${(order?.deliveryCharge || '0') !== '0' ? 'text-primaryRed' : ''}`}>₹{order?.deliveryCharge || '0'}</Text>
                        {/* Offer */}
                        <Text className={`text-center w-[80px] text-[12px] py-[5px] ${(order?.totalDiscount || 0) !== 0 ? 'text-primaryGreen' : ''}`}>₹{order?.totalDiscount || '0'}</Text>
                        {/* Order Time */}
                        <Text className={`text-center w-[130px] text-[12px] py-[5px]`}>{order?.orderTime?.toDate()?.toLocaleString() || 'No time'}</Text>
                        {/* Customer Name */}
                        <Text className={`text-center w-[130px] text-[12px] py-[5px]`}>{order?.customerMobileNumber === '1000000001' ? order?.customerNameForCustomisedQR : order?.customerName || 'No Name'}</Text>
                        {/* Customer Mobile Number */}
                        <Text className={`text-center w-[130px] text-[12px] py-[5px]`}>{order?.customerMobileNumber === '1000000001' ? order?.customerMobileNumberForCustomisedQR : order?.customerMobileNumber || 'No Mob. no.'}</Text>
                        {/* Customer Address */}
                        <Text className={`text-center w-[600px] text-[12px] py-[5px]`}>{order?.customerMobileNumber === '1000000001' ? 'QR Code' : `${order?.address?.customerPlotNumber}, ${order?.address?.customerComplexNameOrBuildingName}, ${order?.address?.customerLandmark}, ${order?.address?.customerRoadNameOrStreetName}, ${order?.address?.customerVillageNameOrTownName}, ${order?.address?.customerCity}, ${order?.address?.customerState} - ${order?.address?.customerPincode}, ${order?.address?.mobileNumberForAddress}` || 'No Add.'}</Text>
                      </View>
                    ))}

                  {vendorOrders.length === 0 && !isBulkEditingLoaderVisible && (
                    <Text className="text-center py-4 text-gray-500">No orders found</Text>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}

        {activeSection === 'quickitemediting' && (
          <View>
            {vendorItemsList.length > 0 && (
              (() => {
                // Group items by category
                const groupedByCategory = vendorItemsList.reduce((acc, item) => {
                  const categoryId = item.categoryId || 'Uncategorized';
                  if (!acc[categoryId]) {
                    acc[categoryId] = [];
                  }
                  acc[categoryId].push(item);
                  return acc;
                }, {});

                // Convert to array for FlatList
                const categorySections = Object.entries(groupedByCategory).map(([categoryId, items]) => ({
                  categoryId,
                  categoryName: categories.find((category) => category.id === categoryId)?.categoryName || 'Uncategorized',
                  items
                }));

                const categorizedSections = categorySections.filter(s => s.categoryId !== 'Uncategorized');
                const uncategorizedSection = categorySections.find(s => s.categoryId === 'Uncategorized');

                // Sort only categorized sections
                const sortedCategorizedSections = categorizedSections.sort((a, b) => {
                  const posA = categories.find(cat => cat.id === a.categoryId)?.position || 0;
                  const posB = categories.find(cat => cat.id === b.categoryId)?.position || 0;
                  return posA - posB;
                });

                // Combine: sorted categorized + uncategorized at end
                const sortedCategorySections = [...sortedCategorizedSections, ...(uncategorizedSection ? [uncategorizedSection] : [])];
                // Compute global numbering by processing each sorted category section sequentially
                const numberedItems = [];
                let globalCounter = vendorItemsList.length;  // Start from total length for descending
                sortedCategorySections.forEach(section => {
                  const sectionSortedItems = section.items.sort((a, b) => (a.position || 0) - (b.position || 0));
                  sectionSortedItems.forEach((item, sectionIndex) => {
                    const sectionNameGroup = sectionSortedItems.filter(
                      (itm) => itm.name.toLowerCase() === item.name.toLowerCase()
                    );
                    const firstSectionIndexOfGroup = sectionSortedItems.findIndex(
                      (i) => i.name.toLowerCase() === item.name.toLowerCase()
                    );

                    if (sectionNameGroup.length > 1 && firstSectionIndexOfGroup === sectionIndex) {
                      const sortedGroupForNumbering = sectionNameGroup.sort((a, b) => (a.groupPosition || 0) - (b.groupPosition || 0));
                      sortedGroupForNumbering.forEach((gItem) => {
                        numberedItems.push({ ...gItem, itemNumber: globalCounter });
                        globalCounter--;
                      });
                    } else if (sectionNameGroup.length === 1) {
                      numberedItems.push({ ...item, itemNumber: globalCounter });
                      globalCounter--;
                    }
                  });
                });
                const ItemNameCell = ({ item }) => (
                  <View
                    className="border-t border-t-white h-full w-[150px] mr-1 justify-center items-center bg-[#ccc]"
                    style={{ minHeight: 60 }} // fallback minimum height
                  >
                    {/* This inner View takes 100% of the parent's height */}
                    <View className="flex-1 justify-center items-center w-full px-2">
                      <Text className="text-black font-medium text-center">
                        {item?.name || 'No Name'}
                      </Text>
                    </View>

                    {/* Button always sticks to the bottom */}
                    <TouchableOpacity
                      onPress={() => { setAddNewVariantSectionVisibleFor(item?.id); setAddNewItemSectionVisibleFor(null) }}
                      className="mb-2 bg-primary rounded-[5px] px-3 py-1.5"
                      activeOpacity={0.7}
                    >
                      <Text className="text-white font-bold text-xs">Add New Variant +</Text>
                    </TouchableOpacity>
                  </View>
                );
                return (
                  <ScrollView nestedScrollEnabled={true} horizontal={true}>
                    <View style={{ flex: 1 }}>
                      {isBulkEditingLoaderVisible && (
                        <Loader />
                      )}
                      {/* Header Row */}
                      <View className='flex-row bg-[#f0f0f0] sticky top-[0px] z-50 gap-[4px]'>
                        <Text className='text-center w-[120px] text-[12px] bg-black text-white py-[5px]' >Category</Text>
                        <Text className='text-center w-[150px] text-[12px] bg-black text-white py-[5px]' >Item Name</Text>
                        <Text className='text-center w-[214px] text-[12px] bg-black text-white py-[5px]' >Variant Name</Text>
                        <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Sell. Price</Text>
                        <Text className='text-center w-[80px] text-[10px] bg-black text-white py-[5px]' >Measurement</Text>
                        <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >MRP</Text>
                        <Text className='text-center w-[70px] text-[12px] bg-black text-white py-[5px]' >Stock</Text>
                        <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Buy. Price</Text>
                        <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Buy. Limit</Text>
                      </View>

                      {/* Data Rows */}
                      <ScrollView nestedScrollEnabled={true} style={{ height: 'calc(100vh - 200px)' }} >
                        {sortedCategorySections.map((section) => (
                          <View className="mb-[2px] flex-row" key={section?.categoryName}>
                            {/* Category Header */}
                            {section.categoryName !== 'Uncategorized' ? (
                              <View className="bg-wheat w-[120px] items-center justify-center mr-[4px]">
                                <Text className="text-black text-[16px] text-center">
                                  {section.categoryName}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => { setAddNewItemSectionVisibleFor(section?.categoryId); setAddNewVariantSectionVisibleFor(null) }}
                                  className="mb-2 bg-primary rounded-[5px] px-3 py-1.5"
                                  activeOpacity={0.7}
                                >
                                  <Text className="text-white font-bold text-xs">Add New Item +</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View className="w-[120px] items-center justify-center mr-[4px]" />
                            )}

                            <View className='' >
                              {/* All items in this category */}
                              {section.items
                                .sort((a, b) => (a.position || 0) - (b.position || 0))
                                .map((item, index) => {
                                  const nameGroup = section.items.filter(
                                    (itm) => itm.name.toLowerCase() === item.name.toLowerCase()
                                  );
                                  const sortedNameGroup = nameGroup.sort(
                                    (a, b) => (a.groupPosition || 0) - (b.groupPosition || 0)
                                  );
                                  const isItemsMultiple = nameGroup.length > 1;
                                  const firstIndexOfGroup = section.items.findIndex(
                                    (i) => i.name.toLowerCase() === item.name.toLowerCase()
                                  );

                                  // Render only once per name group when duplicates exist
                                  if (isItemsMultiple && section.items[firstIndexOfGroup].id !== item.id) {
                                    return null;
                                  }

                                  return (
                                    <View
                                      key={item.id}
                                    >
                                      {isItemsMultiple ? (
                                        /* Horizontal scrolling row for same-name items (variants side-by-side) */
                                        <ScrollView vertical showsHorizontalScrollIndicator={false}>
                                          <View className="items-start">
                                            {sortedNameGroup.map((groupedItem) => (
                                              <View key={groupedItem.id} className={`flex-row items-start`}>
                                                <ItemNameCell item={groupedItem} />
                                                {groupedItem.variants?.length > 0 ? (
                                                  <View className='bg-[#e6f3ff]' >
                                                    {groupedItem.variants.map((variant) => (
                                                      <View className="flex-row gap-[4px]" key={variant?.id}>
                                                        <TouchableOpacity className='w-[60px] bg-primaryRed border border-[#ffffff] items-center justify-center' onPress={() => handleDeleteVariant(groupedItem, variant)}><Text className='text-center text-white' >Delete</Text></TouchableOpacity>
                                                        <EditableField
                                                          itemId={groupedItem.id}
                                                          variantId={variant.id}
                                                          fieldName="variantName"
                                                          value={variant?.variantName || ''}
                                                          width={150}
                                                          placeholder="Name"
                                                          onSave={handleSaveField}
                                                        />
                                                        <EditableField
                                                          itemId={groupedItem.id}
                                                          variantId={variant.id}
                                                          fieldName="sellingPrice"
                                                          value={variant?.prices?.[0]?.variantSellingPrice?.toString() || ''}
                                                          width={80}
                                                          placeholder="SP"
                                                          keyboardType="numeric"
                                                          onSave={handleSaveField}
                                                        />
                                                        <EditableField
                                                          itemId={groupedItem.id}
                                                          variantId={variant.id}
                                                          fieldName="measurement"
                                                          value={variant?.prices?.[0]?.variantMeasurement || ''}
                                                          width={80}
                                                          placeholder="Mea."
                                                          onSave={handleSaveField}
                                                        />
                                                        <EditableField
                                                          itemId={groupedItem.id}
                                                          variantId={variant.id}
                                                          fieldName="mrp"
                                                          value={variant?.prices?.[0]?.variantMrp?.toString() || ''}
                                                          width={80}
                                                          placeholder="MRP"
                                                          keyboardType="numeric"
                                                          onSave={handleSaveField}
                                                        />
                                                        <EditableField
                                                          itemId={groupedItem.id}
                                                          variantId={variant.id}
                                                          fieldName="stock"
                                                          value={variant?.variantStock?.toString() || ''}
                                                          width={70}
                                                          placeholder="0"
                                                          keyboardType="numeric"
                                                          onSave={handleSaveField}
                                                        />
                                                        <EditableField
                                                          itemId={groupedItem.id}
                                                          variantId={variant.id}
                                                          fieldName="buyingPrice"
                                                          value={variant?.prices?.[0]?.variantPrice?.toString() || ''}
                                                          width={80}
                                                          placeholder="BP"
                                                          keyboardType="numeric"
                                                          onSave={handleSaveField}
                                                        />
                                                        <EditableField
                                                          itemId={groupedItem.id}
                                                          variantId={variant.id}
                                                          fieldName="buyingLimit"
                                                          value={(variant?.buyingLimit || '').toString() || ''}
                                                          width={80}
                                                          placeholder="Enter Limit"
                                                          keyboardType="numeric"
                                                          onSave={handleSaveField}
                                                        />
                                                      </View>
                                                    ))}
                                                    {addNewVariantSectionVisibleFor === groupedItem?.id && (
                                                      <View className="flex-row gap-[4px] h-[40px] items-center bg-white">
                                                        <TextInput
                                                          className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px] ml-[64]"
                                                          placeholder="Variant Name"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantName}
                                                          onChangeText={setNewVariantName}
                                                          autoFocus
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="Sell. Price"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantSellingPrice}
                                                          onChangeText={setNewVariantSellingPrice}
                                                        />

                                                        <TextInput
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[10px] py-[5px]"
                                                          placeholder="Measurement"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantMeasurement}
                                                          onChangeText={setNewVariantMeasurement}
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="MRP"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantMRP}
                                                          onChangeText={setNewVariantMRP}
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[70px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="Stock"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantStock}
                                                          onChangeText={setNewVariantStock}
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="Buy. Price"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantBuyingPrice}
                                                          onChangeText={setNewVariantBuyingPrice}
                                                        />

                                                        <TouchableOpacity
                                                          onPress={handleAddNewVariant}
                                                          className="bg-primaryGreen px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                        >
                                                          <Text className="text-white font-bold text-[12px] text-center">Save</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                          onPress={() => setAddNewVariantSectionVisibleFor(null)}
                                                          className="bg-primaryRed px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                        >
                                                          <Text className="text-white font-bold text-[12px] text-center">Cancel</Text>
                                                        </TouchableOpacity>
                                                      </View>
                                                    )}
                                                  </View>
                                                ) : (
                                                  <View className="bg-[#e6f3ff]">
                                                    <View className="flex-row gap-[4px]">
                                                      <Text className="border border-[#ccc] w-[150px] text-center text-primaryRed">{groupedItem?.variantName || 'No Variant'}</Text>
                                                      <Text className="border border-[#ccc] w-[80px] text-center">{groupedItem?.prices?.[0]?.sellingPrice?.toString() || 'SP'}</Text>
                                                      <Text className="border border-[#ccc] w-[80px] text-center">{groupedItem?.prices?.[0]?.measurement || 'Mea.'}</Text>
                                                      <Text className="border border-[#ccc] w-[80px] text-center">{groupedItem?.prices?.[0]?.mrp?.toString() || 'MRP'}</Text>
                                                      <Text className="border border-[#ccc] w-[70px] text-center">{groupedItem?.stock?.toString() || '0'}</Text>
                                                      <Text className="border border-[#ccc] w-[80px] text-center">{groupedItem?.prices?.[0]?.price?.toString() || 'BP'}</Text>
                                                    </View>
                                                    {addNewVariantSectionVisibleFor === groupedItem?.id && (
                                                      <View className="flex-row gap-[4px] h-[40px] items-center bg-white">
                                                        <TextInput
                                                          className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px] ml-[64]"
                                                          placeholder="Variant Name"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantName}
                                                          onChangeText={setNewVariantName}
                                                          autoFocus
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="Sell. Price"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantSellingPrice}
                                                          onChangeText={setNewVariantSellingPrice}
                                                        />

                                                        <TextInput
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[10px] py-[5px]"
                                                          placeholder="Measurement"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantMeasurement}
                                                          onChangeText={setNewVariantMeasurement}
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="MRP"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantMRP}
                                                          onChangeText={setNewVariantMRP}
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[70px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="Stock"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantStock}
                                                          onChangeText={setNewVariantStock}
                                                        />

                                                        <TextInput
                                                          keyboardType="numeric"
                                                          className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                          placeholder="Buy. Price"
                                                          placeholderTextColor="#ccc"
                                                          value={newVariantBuyingPrice}
                                                          onChangeText={setNewVariantBuyingPrice}
                                                        />

                                                        <TouchableOpacity
                                                          onPress={handleAddNewVariant}
                                                          className="bg-primaryGreen px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                        >
                                                          <Text className="text-white font-bold text-[12px] text-center">Save</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                          onPress={() => setAddNewVariantSectionVisibleFor(null)}
                                                          className="bg-primaryRed px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                        >
                                                          <Text className="text-white font-bold text-[12px] text-center">Cancel</Text>
                                                        </TouchableOpacity>
                                                      </View>
                                                    )}
                                                  </View>
                                                )}
                                              </View>
                                            ))}
                                          </View>
                                        </ScrollView>
                                      ) : (
                                        /* Single item → normal vertical variants */
                                        <View className={`flex-row items-start`}>
                                          <ItemNameCell item={item} />

                                          {item.variants?.length > 0 ? (
                                            <View className="flex-1 bg-[#e6f3ff]">
                                              {item.variants.map((variant) => (
                                                <View className="flex-row gap-[4px]" key={variant?.id}>
                                                  <TouchableOpacity className='w-[60px] bg-primaryRed border border-[#ffffff] items-center justify-center' onPress={() => handleDeleteVariant(item, variant)}><Text className='text-center text-white' >Delete</Text></TouchableOpacity>
                                                  <EditableField
                                                    itemId={item.id}
                                                    variantId={variant.id}
                                                    fieldName="variantName"
                                                    value={variant?.variantName || ''}
                                                    width={150}
                                                    placeholder="Name"
                                                    onSave={handleSaveField}
                                                  />
                                                  <EditableField
                                                    itemId={item.id}
                                                    variantId={variant.id}
                                                    fieldName="sellingPrice"
                                                    value={variant?.prices?.[0]?.variantSellingPrice?.toString() || ''}
                                                    width={80}
                                                    placeholder="SP"
                                                    keyboardType="numeric"
                                                    onSave={handleSaveField}
                                                  />
                                                  <EditableField
                                                    itemId={item.id}
                                                    variantId={variant.id}
                                                    fieldName="measurement"
                                                    value={variant?.prices?.[0]?.variantMeasurement || ''}
                                                    width={80}
                                                    placeholder="Mea."
                                                    onSave={handleSaveField}
                                                  />
                                                  <EditableField
                                                    itemId={item.id}
                                                    variantId={variant.id}
                                                    fieldName="mrp"
                                                    value={variant?.prices?.[0]?.variantMrp?.toString() || ''}
                                                    width={80}
                                                    placeholder="MRP"
                                                    keyboardType="numeric"
                                                    onSave={handleSaveField}
                                                  />
                                                  <EditableField
                                                    itemId={item.id}
                                                    variantId={variant.id}
                                                    fieldName="stock"
                                                    value={variant?.variantStock?.toString() || ''}
                                                    width={70}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    onSave={handleSaveField}
                                                  />
                                                  <EditableField
                                                    itemId={item.id}
                                                    variantId={variant.id}
                                                    fieldName="buyingPrice"
                                                    value={variant?.prices?.[0]?.variantPrice?.toString() || ''}
                                                    width={80}
                                                    placeholder="BP"
                                                    keyboardType="numeric"
                                                    onSave={handleSaveField}
                                                  />
                                                  <EditableField
                                                    itemId={item.id}
                                                    variantId={variant.id}
                                                    fieldName="buyingLimit"
                                                    value={(variant?.buyingLimit || '').toString() || ''}
                                                    width={80}
                                                    placeholder="Enter Limit"
                                                    keyboardType="numeric"
                                                    onSave={handleSaveField}
                                                  />
                                                </View>
                                              ))}
                                              {addNewVariantSectionVisibleFor === item?.id && (
                                                <View className="flex-row gap-[4px] h-[40px] items-center bg-white">
                                                  <TextInput
                                                    className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px] ml-[64px]"
                                                    placeholder="Variant Name"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantName}
                                                    onChangeText={setNewVariantName}
                                                    autoFocus
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="Sell. Price"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantSellingPrice}
                                                    onChangeText={setNewVariantSellingPrice}
                                                  />

                                                  <TextInput
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[10px] py-[5px]"
                                                    placeholder="Measurement"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantMeasurement}
                                                    onChangeText={setNewVariantMeasurement}
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="MRP"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantMRP}
                                                    onChangeText={setNewVariantMRP}
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[70px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="Stock"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantStock}
                                                    onChangeText={setNewVariantStock}
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="Buy. Price"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantBuyingPrice}
                                                    onChangeText={setNewVariantBuyingPrice}
                                                  />

                                                  <TouchableOpacity
                                                    onPress={handleAddNewVariant}
                                                    className="bg-primaryGreen px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                  >
                                                    <Text className="text-white font-bold text-[12px] text-center">Save</Text>
                                                  </TouchableOpacity>

                                                  <TouchableOpacity
                                                    onPress={() => setAddNewVariantSectionVisibleFor(null)}
                                                    className="bg-primaryRed px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                  >
                                                    <Text className="text-white font-bold text-[12px] text-center">Cancel</Text>
                                                  </TouchableOpacity>
                                                </View>
                                              )}
                                            </View>
                                          ) : (
                                            <View className="flex-1 bg-[#e6f3ff]">
                                              <View className="flex-row gap-[4px]">
                                                <Text className="border border-[#ccc] w-[150px] text-center text-primaryRed">{item?.variantName || 'Not Variant'}</Text>
                                                <Text className="border border-[#ccc] w-[80px] text-center">{item?.prices?.[0]?.sellingPrice?.toString() || 'SP'}</Text>
                                                <Text className="border border-[#ccc] w-[80px] text-center">{item?.prices?.[0]?.measurement || 'Mea.'}</Text>
                                                <Text className="border border-[#ccc] w-[80px] text-center">{item?.prices?.[0]?.mrp?.toString() || 'MRP'}</Text>
                                                <Text className="border border-[#ccc] w-[70px] text-center">{item?.stock?.toString() || '0'}</Text>
                                                <Text className="border border-[#ccc] w-[80px] text-center">{item?.prices?.[0]?.price?.toString() || 'BP'}</Text>
                                              </View>
                                              {addNewVariantSectionVisibleFor === item?.id && (
                                                <View className="flex-row gap-[4px] h-[40px] items-center bg-white">
                                                  <TextInput
                                                    className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px] ml-[64px]"
                                                    placeholder="Variant Name"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantName}
                                                    onChangeText={setNewVariantName}
                                                    autoFocus
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="Sell. Price"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantSellingPrice}
                                                    onChangeText={setNewVariantSellingPrice}
                                                  />

                                                  <TextInput
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[10px] py-[5px]"
                                                    placeholder="Measurement"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantMeasurement}
                                                    onChangeText={setNewVariantMeasurement}
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="MRP"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantMRP}
                                                    onChangeText={setNewVariantMRP}
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[70px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="Stock"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantStock}
                                                    onChangeText={setNewVariantStock}
                                                  />

                                                  <TextInput
                                                    keyboardType="numeric"
                                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                                    placeholder="Buy. Price"
                                                    placeholderTextColor="#ccc"
                                                    value={newVariantBuyingPrice}
                                                    onChangeText={setNewVariantBuyingPrice}
                                                  />

                                                  <TouchableOpacity
                                                    onPress={handleAddNewVariant}
                                                    className="bg-primaryGreen px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                  >
                                                    <Text className="text-white font-bold text-[12px] text-center">Save</Text>
                                                  </TouchableOpacity>

                                                  <TouchableOpacity
                                                    onPress={() => setAddNewVariantSectionVisibleFor(null)}
                                                    className="bg-primaryRed px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                                  >
                                                    <Text className="text-white font-bold text-[12px] text-center">Cancel</Text>
                                                  </TouchableOpacity>
                                                </View>
                                              )}
                                            </View>
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}
                              {addNewItemSectionVisibleFor === section?.categoryId && (
                                <View className="flex-row gap-[4px] h-[40px] items-center">
                                  <TextInput
                                    className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px]"
                                    placeholder="Item Name"
                                    placeholderTextColor="#ccc"
                                    value={newItemName}
                                    onChangeText={setNewItemName}
                                    autoFocus
                                  />

                                  <TextInput
                                    className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px] ml-[64]"
                                    placeholder="Variant Name"
                                    placeholderTextColor="#ccc"
                                    value={newVariantName}
                                    onChangeText={setNewVariantName}
                                  />

                                  <TextInput
                                    keyboardType="numeric"
                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                    placeholder="Sell. Price"
                                    placeholderTextColor="#ccc"
                                    value={newVariantSellingPrice}
                                    onChangeText={setNewVariantSellingPrice}
                                  />

                                  <TextInput
                                    className="border border-[#ccc] w-[80px] text-center text-black text-[10px] py-[5px]"
                                    placeholder="Measurement"
                                    placeholderTextColor="#ccc"
                                    value={newVariantMeasurement}
                                    onChangeText={setNewVariantMeasurement}
                                  />

                                  <TextInput
                                    keyboardType="numeric"
                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                    placeholder="MRP"
                                    placeholderTextColor="#ccc"
                                    value={newVariantMRP}
                                    onChangeText={setNewVariantMRP}
                                  />

                                  <TextInput
                                    keyboardType="numeric"
                                    className="border border-[#ccc] w-[70px] text-center text-black text-[12px] py-[5px]"
                                    placeholder="Stock"
                                    placeholderTextColor="#ccc"
                                    value={newVariantStock}
                                    onChangeText={setNewVariantStock}
                                  />

                                  <TextInput
                                    keyboardType="numeric"
                                    className="border border-[#ccc] w-[80px] text-center text-black text-[12px] py-[5px]"
                                    placeholder="Buy. Price"
                                    placeholderTextColor="#ccc"
                                    value={newVariantBuyingPrice}
                                    onChangeText={setNewVariantBuyingPrice}
                                  />

                                  <TouchableOpacity
                                    onPress={handleAddNewItem}
                                    className="bg-primaryGreen px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                  >
                                    <Text className="text-white font-bold text-[12px] text-center">Save</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    onPress={() => setAddNewItemSectionVisibleFor(null)}
                                    className="bg-primaryRed px-[10px] py-[5px] w-[70px] rounded-md justify-center"
                                  >
                                    <Text className="text-white font-bold text-[12px] text-center">Cancel</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  </ScrollView>
                );
              })()
            )}
          </View>
        )}

        {activeSection === 'serviceareafencing' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'deliverymodes' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'deliveryconditions' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'myoffers' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'categories' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'arrangeitems' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'myqrs' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'mybanners' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}

        {activeSection === 'sharingdetails' && (
          <Text className='p-[10px] text-center text-[24px]' >Comming Soon...</Text>
        )}
      </View>

      {showSaveAlert && (
        <View className="absolute inset-0 bg-black bg-opacity-50 justify-center items-center z-50 max-w-[600px]">
          <View className="bg-white p-4 rounded-lg mx-4">
            <Text className="text-lg font-bold mb-2">Save Changes?</Text>
            <Text className="mb-4">You have unsaved changes. Do you want to save before editing another field?</Text>
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => {
                  if (editingField && nextEditField) {
                    // Save current changes first
                    const { itemId, variantId, fieldName, value } = editingField;
                    const currentValue = pendingChanges[`${itemId}-${variantId}-${fieldName}`] || value;
                    handleSaveField(itemId, variantId, fieldName, currentValue);
                    setEditingField(nextEditField);
                  }
                  setShowSaveAlert(false);
                  setNextEditField(null);
                }}
                className="bg-green-500 px-4 py-2 rounded"
              >
                <Text className="text-white">Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (editingField && nextEditField) {
                    // Discard current changes
                    setEditingField(nextEditField);
                    setPendingChanges(prev => {
                      const newChanges = { ...prev };
                      delete newChanges[`${editingField.itemId}-${editingField.variantId}-${editingField.fieldName}`];
                      return newChanges;
                    });
                  }
                  setShowSaveAlert(false);
                  setNextEditField(null);
                }}
                className="bg-gray-500 px-4 py-2 rounded"
              >
                <Text className="text-white">Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowSaveAlert(false);
                  setNextEditField(null);
                }}
                className="bg-red-500 px-4 py-2 rounded"
              >
                <Text className="text-white">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isTotalItemsListModalVisible && (
        <Modal animationType={'slide'} transparent={true} visible={isTotalItemsListModalVisible}>
          <View className='p-[10px] h-full w-full bg-[#00000060] items-center justify-center'>
            <View className='h-full w-full rounded-[5px] bg-white p-[10px] max-w-[600px]'>
              <TouchableOpacity onPress={() => setIsPrintingModalForSelectedOrdersVisible(true)} className='absolute top-[10px] left-[10px] z-50'>
                <Image source={require('@/assets/images/printImage.png')} style={{ height: 30, width: 30 }} />
              </TouchableOpacity>

              <Text className='text-[18px] text-primary font-bold text-center'>Selected Items Summary</Text>

              <TouchableOpacity onPress={() => setIsTotalItemsListModalVisible(false)} className='absolute top-[10px] right-[10px] z-50'>
                <Image source={require('@/assets/images/crossImage.png')} style={{ height: 30, width: 30 }} />
              </TouchableOpacity>

              {/* Header for items list */}
              <View className="flex-row justify-between items-center p-[10px] bg-gray-100 border-b border-gray-300 mt-[10px]">
                <View className='flex-1' >
                  <Text className="font-bold flex-1">Total Orders:</Text>
                  <Text className="font-bold flex-1">Total Qty:</Text>
                  <Text className="font-bold flex-1">Sub Total:</Text>
                  <Text className="font-bold flex-1">Delivery Charges:</Text>
                  <Text className="font-bold flex-1">Offers:</Text>
                  <Text className="font-bold flex-1">Grand Total:</Text>
                </View>

                <View className='items-end' >
                  <Text className="font-bold flex-1">{Object?.values(ordersToSummarize)?.length}</Text>
                  <Text className="font-bold flex-1">{Object.values(ordersToSummarize).reduce((total, order) => total + (order?.items?.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0) || 0), 0)}</Text>
                  <Text className="font-bold flex-1">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.items?.reduce((innerTotal, item) => innerTotal + Number(Number(item?.quantity || 0) * Number(item?.price?.[0]?.sellingPrice || 0)), 0) || 0), 0)?.toFixed(2)}</Text>
                  <Text className="font-bold flex-1">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.deliveryCharge || 0), 0)?.toFixed(2)}</Text>
                  <Text className="font-bold flex-1">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.totalDiscount || 0), 0)?.toFixed(2)}</Text>
                  <Text className="font-bold flex-1">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.totalAmount || 0), 0)?.toFixed(2)}</Text>
                </View>
              </View>

              <FlatList
                data={(() => {
                  // Create an object to aggregate items by their unique properties
                  const aggregatedItems = {};

                  Object.values(ordersToSummarize).forEach(order => {
                    order.items?.forEach(item => {
                      // Create a unique key based on all properties that should match
                      const key = `${item.name}-${item.price?.[0]?.measurement}-${item.price?.[0]?.sellingPrice}-${item.variantName || ''}`;

                      if (aggregatedItems[key]) {
                        // If item already exists, increment quantity
                        aggregatedItems[key].quantity += Number(item.quantity) || 0;
                      } else {
                        // If item doesn't exist, add it
                        aggregatedItems[key] = {
                          ...item,
                          quantity: Number(item.quantity) || 0
                        };
                      }
                    });
                  });

                  return Object.values(aggregatedItems).sort((a, b) => a?.name?.localeCompare(b?.name));
                })()}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View className='bg-white rounded-[5px] p-[10px] w-full flex-row h-[120px] border' >
                    <Image style={{ height: 100, width: 100 }} className='rounded-[5px] shadow-md' resizeMode='stretch' source={item?.imageURL ? { uri: item?.imageURL } : require('@/assets/images/placeholderImage.png')} />
                    <View className='h-full justify-between ml-[5px] flex-1' >
                      <View className='flex-row justify-between items-center' >
                        <Text>{item?.name}</Text>
                        {item?.variantName && item?.variantName !== '' && <Text className='p-[2px] border border-primary rounded-[5px]' >{item?.variantName}</Text>}
                      </View>
                      <View className='flex-row justify-between items-center' >
                        <Text>MRP: ₹{item?.price?.[0]?.mrp}</Text>
                        <Text>QTY: {item?.quantity}</Text>
                      </View>
                      <View className='flex-row justify-between items-center' >
                        <Text>₹{item?.price?.[0]?.sellingPrice}/{item?.price?.[0]?.measurement}</Text>
                        <Text>Sub Total: ₹{Number(item?.price?.[0]?.sellingPrice) * Number(item?.quantity)}</Text>
                      </View>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text className="text-center text-gray-500 p-4">No items in selected orders</Text>
                }
              />
            </View>
          </View>
        </Modal>
      )}

      {isCustomRangeModalVisible && (
        <Modal animationType="slide" transparent={true} visible={isCustomRangeModalVisible}>
          <View className='p-[10px] h-full w-full bg-[#00000060] items-center justify-center'>
            <View className='h-[580px] w-full max-w-md rounded-[5px] bg-white p-[10px] max-w-[600px]'>

              <Text className='text-[20px] text-primary font-bold text-center mb-4'>
                Select Custom Date Range
              </Text>

              <TouchableOpacity
                onPress={() => setIsCustomRangeModalVisible(false)}
                className='absolute top-[10px] right-[10px] z-50'
              >
                <Image source={require('@/assets/images/crossImage.png')} style={{ height: 30, width: 30 }} />
              </TouchableOpacity>

              {/* Calendar */}
              <View className="flex-1 mt-4">
                <Calendar
                  current={customEndDate?.toISOString().split('T')[0]}
                  minDate={'2020-01-01'} // optional: set your earliest allowed date
                  maxDate={new Date().toISOString().split('T')[0]} // today as max

                  // Mark selected range
                  markedDates={{
                    ...(customStartDate && {
                      [customStartDate.toISOString().split('T')[0]]: {
                        selected: true,
                        startingDay: true,
                        color: '#00adf5',
                        textColor: '#ffffff',
                      },
                    }),
                    ...(customEndDate && {
                      [customEndDate.toISOString().split('T')[0]]: {
                        selected: true,
                        endingDay: true,
                        color: '#00adf5',
                        textColor: '#ffffff',
                      },
                    }),
                    ...getDatesInRange(customStartDate, customEndDate),
                  }}

                  // Allow range selection
                  onDayPress={(day) => {
                    const selectedDate = new Date(day.dateString);

                    if (!customStartDate) {
                      // First selection - set both start and end to same date
                      setCustomStartDate(selectedDate);
                      setCustomEndDate(selectedDate);
                    } else if (!customEndDate && selectedDate >= customStartDate) {
                      // Second selection - valid end date
                      setCustomEndDate(selectedDate);
                    } else {
                      // Reset selection
                      setCustomStartDate(selectedDate);
                      setCustomEndDate(null);
                    }
                  }}

                  // Styling
                  theme={{
                    selectedDayBackgroundColor: '#00adf5',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#00adf5',
                    arrowColor: '#00adf5',
                    monthTextColor: '#00adf5',
                    textDayFontWeight: '500',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                  }}

                  enableSwipeMonths={true}
                  hideExtraDays={true}
                />

                {/* Show selected range below calendar */}
                <View className="mt-4 px-4">
                  <Text className="text-sm text-gray-600">
                    From: <Text className="font-bold">{customStartDate?.toDateString()}</Text>
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    To: <Text className="font-bold">{customEndDate?.toDateString()}</Text>
                  </Text>
                </View>
              </View>

              {/* Quick Range Buttons */}
              <View className="flex-row justify-between mt-4">
                <TouchableOpacity
                  onPress={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 7);
                    setCustomStartDate(start);
                    setCustomEndDate(end);
                  }}
                  className="bg-blue-100 p-3 rounded-[5px] flex-1 mr-1"
                >
                  <Text className="text-center text-blue-800 font-medium">Last 7 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 30);
                    setCustomStartDate(start);
                    setCustomEndDate(end);
                  }}
                  className="bg-blue-100 p-3 rounded-[5px] flex-1 ml-1"
                >
                  <Text className="text-center text-blue-800 font-medium">Last 30 Days</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View className="flex-row justify-between mt-4">
                <TouchableOpacity
                  onPress={() => setIsCustomRangeModalVisible(false)}
                  className="bg-primaryRed p-4 rounded-[5px] flex-1 mr-2"
                >
                  <Text className="text-white text-center font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTimeFilter('custom');
                    setIsCustomRangeModalVisible(false);
                  }}
                  className="bg-primaryGreen p-4 rounded-[5px] flex-1 ml-2"
                >
                  <Text className="text-white text-center font-bold">Apply Filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {isSelectedOrderItemsListModalVisible && (
        <Modal animationType={'slide'} transparent={true} visible={isSelectedOrderItemsListModalVisible}>
          <View className='p-[10px] h-full w-full bg-[#00000060] items-center justify-center'>
            <View className='h-full w-full rounded-[5px] bg-white p-[10px] max-w-[600px]'>
              <Text className='text-[18px] text-primary font-bold text-center'>Selected Order Items Summary</Text>
              <TouchableOpacity onPress={() => setIsSelectedOrderItemsListModalVisible(false)} className='absolute top-[10px] right-[10px] z-50'>
                <Image source={require('@/assets/images/crossImage.png')} style={{ height: 30, width: 30 }} />
              </TouchableOpacity>

              {/* Header for items list */}
              <View className="flex-row justify-between items-center p-2 bg-gray-100 border-b border-gray-300">
                <Text className="font-bold flex-1">Item Details</Text>
                <Text className="font-bold ml-4 w-[60px] text-center">
                  Total Qty ({orderToShowItemsFor?.items?.reduce((total, item) =>
                    total + Number(item?.quantity), 0)
                  })
                </Text>
              </View>

              <FlatList
                data={orderToShowItemsFor.items || []}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View className='bg-white rounded-[5px] p-[10px] w-full flex-row h-[120px] border' >
                    <Image style={{ height: 100, width: 100 }} className='rounded-[5px] shadow-md' resizeMode='stretch' source={item?.imageURL ? { uri: item?.imageURL } : require('@/assets/images/placeholderImage.png')} />
                    <View className='h-full justify-between ml-[5px] flex-1' >
                      <View className='flex-row justify-between items-center' >
                        <Text>{item?.name}</Text>
                        {item?.variantName && item?.variantName !== '' && <Text className='p-[2px] border border-primary rounded-[5px]' >{item?.variantName}</Text>}
                      </View>
                      <View className='flex-row justify-between items-center' >
                        <Text>MRP: ₹{item?.price?.[0]?.mrp}</Text>
                        <Text>QTY: {item?.quantity}</Text>
                      </View>
                      <View className='flex-row justify-between items-center' >
                        <Text>₹{item?.price?.[0]?.sellingPrice}/{item?.price?.[0]?.measurement}</Text>
                        <Text>Sub Total: ₹{Number(item?.price?.[0]?.sellingPrice) * Number(item?.quantity)}</Text>
                      </View>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text className="text-center text-gray-500 p-4">No items in selected orders</Text>
                }
              />
            </View>
          </View>
        </Modal>
      )}

      {isEditOrderModalVisible && (
        <Modal animationType={'slide'} transparent={true} visible={isEditOrderModalVisible}>
          <View className='p-[10px] h-full w-full bg-[#00000060] items-center justify-center'>
            <View className='h-full w-full rounded-[5px] bg-white p-[10px] max-w-[600px]'>
              {isSalesLoaderVisible && (<Loader />)}
              <Text className='text-[24px] text-primary font-bold text-center'>Edit Order</Text>
              <TouchableOpacity onPress={() => { setIsEditOrderModalVisible(false); }} className='absolute top-[10px] right-[10px] z-50'>
                <Image source={require('@/assets/images/crossImage.png')} style={{ height: 30, width: 30 }} />
              </TouchableOpacity>
              <View className='flex-1 items-center justify-center gap-[5px] mt-[10px]' >
                {/* Header for items list */}
                <View className="flex-row justify-between items-center p-[10px] bg-gray-100 border-b border-gray-300 mt-[10px] w-full">
                  <View className='flex-1' >
                    <Text className="flex-1">Total Qty:</Text>
                    <Text className="flex-1">Sub Total:</Text>
                    <Text className="flex-1">Delivery Charge:</Text>
                    <Text className="flex-1">Offer:</Text>
                    <Text className="font-bold flex-1">Grand Total:</Text>
                  </View>

                  <View className='items-end' >
                    <Text className="flex-1">{orderForAction?.items?.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)}</Text>
                    <Text className="flex-1">₹{orderForAction?.items?.reduce((innerTotal, item) => innerTotal + Number(Number(item?.quantity || 0) * Number(item?.price?.[0]?.sellingPrice || 0)), 0)?.toFixed(2)}</Text>
                    <Text className="flex-1">₹{Number(orderForAction?.deliveryCharge || 0)?.toFixed(2)}</Text>
                    <Text className="flex-1">₹{Number(orderForAction?.totalDiscount || 0)?.toFixed(2)}</Text>
                    <Text className="font-bold flex-1">₹{Number(orderForAction?.totalAmount || 0)?.toFixed(2)}</Text>
                  </View>
                </View>

                <FlatList
                  data={(() => {
                    // Create an object to aggregate items by their unique properties
                    const aggregatedItems = {};

                    orderForAction.items?.forEach(item => {
                      // Create a unique key based on all properties that should match
                      const key = `${item.name}-${item.price?.[0]?.measurement}-${item.price?.[0]?.sellingPrice}-${item.variantName || ''}`;

                      if (aggregatedItems[key]) {
                        // If item already exists, increment quantity
                        aggregatedItems[key].quantity += Number(item.quantity) || 0;
                      } else {
                        // If item doesn't exist, add it
                        aggregatedItems[key] = {
                          ...item,
                          quantity: Number(item.quantity) || 0
                        };
                      }
                    });

                    return Object.values(aggregatedItems).sort((a, b) => a?.name?.localeCompare(b?.name));
                  })()}
                  className='w-full'
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item, index }) => (
                    <View className='bg-white rounded-[5px] p-[10px] w-full flex-row h-[120px] border' >
                      <Image style={{ height: 100, width: 100 }} className='rounded-[5px] shadow-md' resizeMode='stretch' source={item?.imageURL ? { uri: item?.imageURL } : require('@/assets/images/placeholderImage.png')} />
                      <View className='h-full justify-between ml-[5px] flex-1' >
                        <View className='flex-row justify-between items-center' >
                          <Text>{item?.name}</Text>
                          {item?.variantName && item?.variantName !== '' && <Text className='p-[2px] border border-primary rounded-[5px]' >{item?.variantName}</Text>}
                        </View>
                        <View className='flex-row justify-between items-center' >
                          <Text>MRP: ₹{item?.price?.[0]?.mrp}</Text>
                          <Text>QTY: <TextInput
                            className='p-[5px] rounded-[5px] border border-[#ccc] w-[60px] text-center'
                            placeholder='Qty'
                            placeholderTextColor={'#ccc'}
                            keyboardType='numeric'
                            value={newQtysForEditingOrder[item.id] !== undefined ? newQtysForEditingOrder[item.id].toString() : item.quantity?.toString()}
                            onChangeText={(text) => {
                              // Allow empty string for complete deletion
                              if (text === '') {
                                setNewQtysForEditingOrder(prev => ({
                                  ...prev,
                                  [item.id]: ''
                                }));
                              } else {
                                // Only convert to number if there's actual input
                                const newQty = text === '' ? '' : Number(text);
                                setNewQtysForEditingOrder(prev => ({
                                  ...prev,
                                  [item.id]: newQty
                                }));
                              }
                            }}
                          /></Text>
                        </View>
                        <View className='flex-row justify-between items-center' >
                          <Text>₹<TextInput
                            className='p-[5px] rounded-[5px] border border-[#ccc] w-[80px] text-center'
                            placeholder='Price'
                            placeholderTextColor={'#ccc'}
                            keyboardType='numeric'
                            value={newSellingPricesForEditingOrder[item.id] !== undefined ? newSellingPricesForEditingOrder[item.id].toString() : item?.price?.[0]?.sellingPrice?.toString()}
                            onChangeText={(text) => {
                              // Allow empty string for complete deletion
                              if (text === '') {
                                setNewSellingPricesForEditingOrder(prev => ({
                                  ...prev,
                                  [item.id]: ''
                                }));
                              } else {
                                // Only convert to number if there's actual input
                                const newPrice = text === '' ? '' : Number(text);
                                setNewSellingPricesForEditingOrder(prev => ({
                                  ...prev,
                                  [item.id]: newPrice
                                }));
                              }
                            }}
                          />/{item?.price?.[0]?.measurement}</Text>
                          <Text>Sub Total: ₹{Number(item?.price?.[0]?.sellingPrice) * Number(item?.quantity)}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text className="text-center text-gray-500 p-4">No items in selected orders</Text>
                  }
                />

                {/* Save Changes Button */}
                <TouchableOpacity
                  onPress={handleSaveOrderChanges}
                  className='p-[15px] bg-primaryGreen rounded-[5px] w-full mt-[10px]'
                >
                  <Text className='text-white text-center font-bold text-[18px]'>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {isPrintingModalForSelectedOrdersVisible && (
        <Modal animationType={'slide'} transparent={true} visible={isPrintingModalForSelectedOrdersVisible}>
          <View className='p-[10px] h-full w-full bg-[#00000060] items-center justify-center'>
            <View className='h-full w-full rounded-[5px] bg-white p-[10px] max-w-[600px]'>
              <Text className='text-[18px] text-primary font-bold text-center'>Print & Share</Text>
              <TouchableOpacity onPress={() => setIsPrintingModalForSelectedOrdersVisible(false)} className='absolute top-[10px] right-[10px] z-50'>
                <Image source={require('@/assets/images/crossImage.png')} style={{ height: 30, width: 30 }} />
              </TouchableOpacity>

              <ScrollView contentContainerStyle={{ height: '100%', marginTop: 10 }} >
                <View ref={billRef} className='w-full rounded-[5px] border-2 border-[#000] p-[10px] bg-white'>
                  <Text className='text-center font-bold'>{vendorFullData?.businessName}</Text>
                  <Text className='text-center text-[12px]' >{vendorFullAddress?.vendorBusinessPlotNumberOrShopNumber}, {vendorFullAddress?.vendorBusinessComplexNameOrBuildingName}, {vendorFullAddress?.vendorBusinessLandmark}, {vendorFullAddress?.vendorBusinessRoadNameOrStreetName}, {vendorFullAddress?.vendorBusinessVillageNameOrTownName}, {vendorFullAddress?.vendorBusinessCity}, {vendorFullAddress?.vendorBusinessState} - {vendorFullAddress?.vendorBusinessPincode}</Text>
                  <Text className='text-center text-[12px]'>Ph. {vendorMobileNumber}</Text>

                  <View className='w-full border-b my-[5px]' />

                  <View className='mb-[2px] flex-row gap-[5px] w-full border-b border-[#ccc]'>
                    <Text className='text-[13px] font-bold'>No.</Text>
                    <Text className='flex-1 text-[13px] font-bold' numberOfLines={1}>Name</Text>
                    <Text className='text-[13px] text-right w-12 font-bold'>QTY</Text>
                    <Text className='text-[13px] text-right w-16 font-bold'>Price</Text>
                    <Text className='text-[13px] text-right w-20 font-bold'>Total</Text>
                  </View>

                  {/* Items List */}
                  {(() => {
                    // Aggregate items by name, variantName, and sellingPrice
                    const aggregatedItems = {};
                    let itemIndex = 0;

                    Object.values(ordersToSummarize).forEach(order => {
                      order.items?.forEach(item => {
                        const key = `${item.name}-${item.variantName || ''}-${item?.price?.[0]?.sellingPrice || 0}`;

                        if (aggregatedItems[key]) {
                          // If item already exists, increment quantity and recalculate total
                          aggregatedItems[key].quantity += Number(item.quantity) || 0;
                          aggregatedItems[key].total = aggregatedItems[key].quantity * Number(item?.price?.[0]?.sellingPrice || 0);
                        } else {
                          // If item doesn't exist, add it with index
                          aggregatedItems[key] = {
                            ...item,
                            quantity: Number(item.quantity) || 0,
                            total: Number(item.quantity) * Number(item?.price?.[0]?.sellingPrice || 0),
                            index: ++itemIndex
                          };
                        }
                      });
                    });

                    // Convert to array and render
                    return Object.values(aggregatedItems).sort((a, b) => a?.name?.localeCompare(b?.name)).map((item, index) => (
                      <View key={`${item.name}-${item.variantName || ''}-${item.index}`} className='mb-[2px] flex-row gap-[5px] w-full'>
                        <Text className='text-[13px]'>{index + 1}.</Text>
                        <Text className='flex-1 text-[13px]'>
                          {item.name}{' '}
                          <Text className='text-[10px]'>
                            {item?.variantName && item?.variantName !== '' ? `(${item?.variantName})` : ''}
                          </Text>
                        </Text>
                        <Text className='text-[13px] text-right w-12'>{item.quantity}</Text>
                        <Text className='text-[13px] text-right w-16'>₹{item?.price?.[0]?.sellingPrice || 0}</Text>
                        <Text className='text-[13px] text-right w-20'>₹{item.total}</Text>
                      </View>
                    ));
                  })()}

                  <View className='w-full border-b my-[5px]' />

                  <View className="flex-row justify-between items-center p-[10px] bg-gray-100 border-b border-gray-300 rounded-[5px]">
                    <View className='flex-1' >
                      <Text className="font-bold flex-1">Total Orders:</Text>
                      <Text className="font-bold flex-1">Total Qty:</Text>
                      <View className='w-full border-b my-[5px]' />
                      <Text className="flex-1">Sub Total:</Text>
                      <Text className="flex-1">Delivery Charges:</Text>
                      <Text className="flex-1">Offers:</Text>
                      <View className='w-full border-b my-[5px]' />
                      <Text className="font-bold flex-1 text-[18px]">Grand Total:</Text>
                    </View>

                    <View className='items-end' >
                      <Text className="font-bold flex-1">{Object?.values(ordersToSummarize)?.length}</Text>
                      <Text className="font-bold flex-1">{Object.values(ordersToSummarize).reduce((total, order) => total + (order?.items?.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0) || 0), 0)}</Text>
                      <View className='w-full border-b my-[5px]' />
                      <Text className="flex-1">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.items?.reduce((innerTotal, item) => innerTotal + Number(Number(item?.quantity || 0) * Number(item?.price?.[0]?.sellingPrice || 0)), 0) || 0), 0)?.toFixed(2)}</Text>
                      <Text className="flex-1">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.deliveryCharge || 0), 0)?.toFixed(2)}</Text>
                      <Text className="flex-1">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.totalDiscount || 0), 0)?.toFixed(2)}</Text>
                      <View className='w-full border-b my-[5px]' />
                      <Text className="font-bold flex-1 text-[18px]">₹{Object.values(ordersToSummarize).reduce((total, order) => total + Number(order?.totalAmount || 0), 0)?.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View className='w-full border-b my-[5px]' />

                  <Text className='text-center font-bold'>Thanks for ordering!</Text>
                </View>
              </ScrollView>

              <TouchableOpacity onPress={shareBill} className='p-[10px] bg-primary rounded-[5px] w-full self-center mt-[5px]' >
                <Text className='font-bold text-white text-center text-[18px]' >Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {isPrintingModalVisible && (
        <Modal animationType={'slide'} transparent={true} visible={isPrintingModalVisible}>
          <View className='p-[10px] h-full w-full bg-[#00000060] items-center justify-center'>
            <View className='h-full w-full rounded-[5px] bg-white p-[10px] max-w-[600px]'>
              <Text className='text-[18px] text-primary font-bold text-center'>Print & Share</Text>
              <TouchableOpacity onPress={() => setIsPrintingModalVisible(false)} className='absolute top-[10px] right-[10px] z-50'>
                <Image source={require('@/assets/images/crossImage.png')} style={{ height: 30, width: 30 }} />
              </TouchableOpacity>

              <ScrollView contentContainerStyle={{ height: '100%', marginTop: 10 }} >
                <View ref={billRef} className='w-full rounded-[5px] border-2 border-[#000] p-[10px] bg-white'>
                  <Text className='text-center font-bold'>{vendorFullData?.businessName}</Text>
                  <Text className='text-center text-[12px]' >{vendorFullAddress?.vendorBusinessPlotNumberOrShopNumber}, {vendorFullAddress?.vendorBusinessComplexNameOrBuildingName}, {vendorFullAddress?.vendorBusinessLandmark}, {vendorFullAddress?.vendorBusinessRoadNameOrStreetName}, {vendorFullAddress?.vendorBusinessVillageNameOrTownName}, {vendorFullAddress?.vendorBusinessCity}, {vendorFullAddress?.vendorBusinessState} - {vendorFullAddress?.vendorBusinessPincode}</Text>
                  <Text className='text-center text-[12px]'>Ph. {vendorMobileNumber}</Text>

                  <View className='w-full border-b my-[5px]' />

                  <Text className='text-center'>Customer: {orderForPrinting?.customerName || orderForPrinting?.customerNameForCustomisedQR || ''}</Text>
                  {orderForPrinting?.address && <Text className='text-center text-[12px]' >{orderForPrinting?.address?.customerPlotNumber}, {orderForPrinting?.address?.customerComplexNameOrBuildingName}, {orderForPrinting?.customerNameForCustomisedQR?.address?.customerLandmark}, {orderForPrinting?.address?.customerRoadNameOrStreetName}, {orderForPrinting?.address?.customerVillageNameOrTownName}, {orderForPrinting?.address?.customerCity}, {orderForPrinting?.address?.customerState} - {orderForPrinting?.address?.customerPincode}</Text>}
                  <Text className='text-center text-[12px]'>Ph. {orderForPrinting?.customerMobileNumber !== '1000000001' ? orderForPrinting?.customerMobileNumber : orderForPrinting?.customerMobileNumberForCustomisedQR || orderForPrinting?.customerMobileNumberForCustomisedQR || ''}</Text>

                  <View className='w-full border-b my-[5px]' />

                  <Text className='text-center'>Order Id: {orderForPrinting?.id}</Text>
                  <Text className='text-center text-[12px]'>{new Date(orderForPrinting.orderTime?.toDate?.() || orderForPrinting.orderTime).toLocaleString()}</Text>
                  <Text className='font-bold text-center'>{orderForPrinting?.deliveryMode || orderForPrinting?.QRCodeMessage || ''}</Text>

                  <View className='w-full border-b my-[5px]' />

                  <View className='mb-[2px] flex-row gap-[5px] w-full border-b border-[#ccc]'>
                    <Text className='text-[13px] font-bold'>No.</Text>
                    <Text className='flex-1 text-[13px] font-bold' numberOfLines={1}>Name</Text>
                    <Text className='text-[13px] text-right w-12 font-bold'>QTY</Text>
                    <Text className='text-[13px] text-right w-16 font-bold'>Price</Text>
                    <Text className='text-[13px] text-right w-20 font-bold'>Total</Text>
                  </View>

                  {/* Items List */}
                  {(() => {
                    // Aggregate items by name, variantName, and sellingPrice
                    const aggregatedItems = {};
                    let itemIndex = 0;

                    orderForPrinting.items?.forEach(item => {
                      const key = `${item.name}-${item.variantName || ''}-${item?.price?.[0]?.sellingPrice || 0}`;

                      if (aggregatedItems[key]) {
                        // If item already exists, increment quantity and recalculate total
                        aggregatedItems[key].quantity += Number(item.quantity) || 0;
                        aggregatedItems[key].total = aggregatedItems[key].quantity * Number(item?.price?.[0]?.sellingPrice || 0);
                      } else {
                        // If item doesn't exist, add it with index
                        aggregatedItems[key] = {
                          ...item,
                          quantity: Number(item.quantity) || 0,
                          total: Number(item.quantity) * Number(item?.price?.[0]?.sellingPrice || 0),
                          index: ++itemIndex
                        };
                      }
                    });

                    // Convert to array and render
                    return Object.values(aggregatedItems).sort((a, b) => a?.name?.localeCompare(b?.name)).map((item, index) => (
                      <View key={`${item.name}-${item.variantName || ''}-${item.index}`} className='mb-[2px] flex-row gap-[5px] w-full'>
                        <Text className='text-[13px]'>{index + 1}.</Text>
                        <Text className='flex-1 text-[13px]'>
                          {item.name}{' '}
                          <Text className='text-[10px]'>
                            {item?.variantName && item?.variantName !== '' ? `(${item?.variantName})` : ''}
                          </Text>
                        </Text>
                        <Text className='text-[13px] text-right w-12'>{item.quantity}</Text>
                        <Text className='text-[13px] text-right w-16'>₹{item?.price?.[0]?.sellingPrice || 0}</Text>
                        <Text className='text-[13px] text-right w-20'>₹{item.total}</Text>
                      </View>
                    ));
                  })()}

                  <View className='w-full border-b my-[5px]' />

                  <View className='flex-row justify-between w-full' >
                    <Text className='text-[13px]'>QTY: {orderForPrinting.items.reduce((total, item) => total + Number(item.quantity), 0)}</Text>
                    <View className='flex-row' >
                      <View>
                        <Text>Sub-Total: </Text>
                        {orderForPrinting.appliedOffers?.[0] && <Text>Offer: </Text>}
                        {orderForPrinting.deliveryCharge > 0 && <Text>Delivery: </Text>}
                      </View>
                      <View>
                        <Text className='text-[13px]'>₹{Number((orderForPrinting.totalAmount.toFixed(2) ?? 0) - (orderForPrinting.deliveryCharge ?? 0) + (orderForPrinting.appliedOffers?.[0]?.discount ?? 0)).toFixed(2)}</Text>
                        {orderForPrinting.appliedOffers?.[0] && <Text className='text-right text-[13px]'>-₹{orderForPrinting.appliedOffers[0].discount}</Text>}
                        {orderForPrinting.deliveryCharge > 0 && <Text className='text-right text-[13px]'>₹{orderForPrinting.deliveryCharge}</Text>}
                      </View>
                    </View>
                  </View>

                  <View className='w-full border-b my-[5px]' />

                  <Text className='text-right font-bold text-[15px]'>Grand Total: ₹{orderForPrinting?.totalAmount.toFixed(2)}</Text>

                  <View className='w-full border-b my-[5px]' />

                  <Text className='text-center font-bold'>Thanks for ordering!</Text>
                </View>
              </ScrollView>

              <TouchableOpacity onPress={shareBill} className='p-[10px] bg-primary rounded-[5px] w-full self-center mt-[5px]' >
                <Text className='font-bold text-white text-center text-[18px]' >Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
