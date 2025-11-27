import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { collection, addDoc, arrayUnion, updateDoc, doc, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '../context/AuthContext'
import Loader from '../components/Loader'

export default function Home() {
  const { vendorMobileNumber } = useAuth()
  const Section = {
    SALES: 'sales',
    BULKEDIT: 'bulkedit',
    SERVICEAREAFENCING: 'serviceareafencing',
    DELIVERYMODES: 'deliverymodes',
    DELIVERYCONDITIONS: 'deliveryconditions',
    MYOFFERS: 'myoffers',
    CATEGORY: 'category',
    ARRANGEITEMS: 'arrangeitems',
    MYQRS: 'myqrs',
    MYBANNERS: 'mybanners',
    SHARINGDETAILS: 'sharingdetails',
    NONE: null,
  };
  const [activeSection, setActiveSection] = useState(Section.NONE);
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

  useEffect(() => {
    fetchVendorItemsList()
    fetchVendorCategories()
    if (vendorMobileNumber) {
      fetchVendorOrders();
    }
  }, [vendorMobileNumber])

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

    const itemExists = vendorItemsList.some(
      (item) => item.name?.toLowerCase().trimEnd() === newItemName.toLowerCase().trimEnd()
    );
    if (itemExists) {
      alert('Duplicate Item', 'An item with this name already exists in this category.');
      setIsBulkEditingLoaderVisible(false);
      return;
    }

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
    onSave
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
            placeholderTextColor="#ccc"
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

  return (
    <View>

      <ScrollView showsHorizontalScrollIndicator={false} contentContainerClassName="gap-[2px]" className="w-full max-h-[100px]" horizontal>
        {/* Sales */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.SALES)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.SALES) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >Sales</Text>
          {/* <Text className="font-bold text-primary text-[16px] text-center" >({allVendorsList?.length || 0})</Text> */}
        </TouchableOpacity>

        {/* Bulk Editing */}
        <TouchableOpacity
          onPress={() => toggleSection(Section.BULKEDIT)}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.BULKEDIT) ? 'bg-wheat' : 'bg-white'} border-primary p-[10px] items-center justify-center`} >
          <Text className="font-bold text-primary text-[16px] text-center" >Bulk Editing</Text>
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
            toggleSection(Section.CATEGORY);
          }}
          className={`h-full w-[120px] border-[5px] rounded-[5px] ${isSectionActive(Section.CATEGORY) ? 'bg-wheat' : 'bg-white'
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
        {activeSection === 'sales' && (
          <View className='flex-1' >
            {Object.keys(ordersToSummarize).length > 0 && (
              <>
              {/* Clear Selection Button - Smaller */}
                <TouchableOpacity
                  onPress={() => setOrdersToSummarize({})}
                  className="bg-primaryRed p-[10px] rounded-[5px] absolute top-[0px] right-[0px]"
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

                  <View className="bg-white p-[5px] rounded-[5px] min-w-[100px] items-center border border-gray-200">
                    <Text className="text-[10px] font-medium text-gray-600 mb-1">Total Items</Text>
                    <Text className="text-[18px] font-bold text-purple-600">
                      {Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (order?.items?.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0) || 0), 0)}
                    </Text>
                  </View>

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
                </ScrollView>

                {/* Additional Summary Details - Compact */}
                <View className="bg-white mt-[5px] p-[5px] rounded-[5px] border border-gray-200 w-[95%] self-center">
                  <Text className="text-[12px] font-bold mb-1">Breakdown:</Text>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-[10px] text-gray-600">Delivery Charges:</Text>
                    <Text className="text-[10px] text-red-600 font-medium">
                      ₹{Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (Number(order?.deliveryCharge) || 0), 0).toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-[10px] text-gray-600">Discounts:</Text>
                    <Text className="text-[10px] text-green-600 font-medium">
                      ₹{Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (Number(order?.totalDiscount) || 0), 0).toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] text-gray-600">Avg. Order Value:</Text>
                    <Text className="text-[10px] font-medium">
                      ₹{(Object.values(ordersToSummarize).reduce((total, order) =>
                        total + (Number(order?.totalAmount) || 0), 0) / (Object.keys(ordersToSummarize).length || 1)).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </>
            )}
            <ScrollView nestedScrollEnabled={true} horizontal={true}>
              <View style={{ flex: 1 }}>
                {/* {isBulkEditingLoaderVisible && <Loader />} */}

                {/* Header Row */}
                <View className='flex-row bg-[#f0f0f0] sticky top-[0px] z-50 gap-[4px]'>
                  <Text className='text-center w-[40px] text-[12px] bg-black text-white py-[5px]' >SR no.</Text>
                  <Text className='text-center w-[160px] text-[12px] bg-black text-white py-[5px]' >Order Id</Text>
                  <Text className='text-center w-[60px] text-[12px] bg-black text-white py-[5px]' >Status</Text>
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Items</Text>
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Total</Text>
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Sub Total</Text>
                  <Text className='text-center w-[100px] text-[12px] bg-black text-white py-[5px]' >Delivery Charge</Text>
                  <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Offer</Text>
                  <Text className='text-center w-[130px] text-[12px] bg-black text-white py-[5px]' >Time</Text>
                </View>

                {/* Data Rows */}
                <ScrollView nestedScrollEnabled={true} style={{ height: 'calc(100vh - 200px)' }} >
                  {vendorOrders.map((order, index) => (
                    <TouchableOpacity key={order.id} onPress={() => setOrdersToSummarize(prev => prev[order.id] ? (() => { const { [order.id]: removed, ...rest } = prev; return rest; })() : { ...prev, [order.id]: order })} className={`flex-row gap-[4px] py-1 border-b border-gray-200 ${ordersToSummarize[order.id] ? 'bg-blue-100' : ''}`}>
                      <Text className='text-center w-[40px] text-[12px] py-[5px]'>{vendorOrders?.length - index}</Text>
                      <Text className='text-center w-[160px] text-[12px] py-[5px]'>{order?.id}</Text>
                      <Text className={`text-center w-[60px] text-[12px] py-[5px] ${order?.orderStatus === 'Pending' ? 'bg-primaryYellow' : order?.orderStatus === 'Approved' ? 'bg-primaryGreen text-white' : 'bg-primaryRed text-white'}`}>{order?.orderStatus || 'Pending'}</Text>
                      <Text className='text-center w-[80px] text-[12px] py-[5px]'>{order?.items?.reduce((total, item) => { const quantity = Number(item?.quantity) || 0; return total + quantity; }, 0) || '0'}</Text>
                      <Text className='text-center w-[80px] text-[12px] py-[5px]'>₹{Number(order?.totalAmount).toFixed(2) || '0'}</Text>
                      <Text className='text-center w-[80px] text-[12px] py-[5px]'>₹{order?.items?.reduce((total, item) => { const sellingPrice = Number(item?.price?.[0]?.sellingPrice) || 0; const quantity = Number(item?.quantity) || 0; return total + (sellingPrice * quantity); }, 0).toFixed(2) || '0'}</Text>
                      <Text className={`text-center w-[100px] text-[12px] py-[5px] ${(order?.deliveryCharge || '0') !== '0' ? 'text-primaryRed' : ''}`}>₹{order?.deliveryCharge || '0'}</Text>
                      <Text className={`text-center w-[80px] text-[12px] py-[5px] ${(order?.totalDiscount || 0) !== 0 ? 'text-primaryGreen' : ''}`}>₹{order?.totalDiscount || '0'}</Text>
                      <Text className={`text-center w-[130px] text-[12px] py-[5px]`}>{order?.orderTime?.toDate()?.toLocaleString() || 'No time'}</Text>
                    </TouchableOpacity>
                  ))}

                  {vendorOrders.length === 0 && !isBulkEditingLoaderVisible && (
                    <Text className="text-center py-4 text-gray-500">No orders found</Text>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}
        {activeSection === 'bulkedit' && (
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
                    className="border border-[#ccc] h-full w-[150px] mr-1 justify-center items-center bg-[#ccc]"
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
                        <Text className='text-center w-[150px] text-[12px] bg-black text-white py-[5px]' >Variant Name</Text>
                        <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Sell. Price</Text>
                        <Text className='text-center w-[80px] text-[10px] bg-black text-white py-[5px]' >Measurement</Text>
                        <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >MRP</Text>
                        <Text className='text-center w-[70px] text-[12px] bg-black text-white py-[5px]' >Stock</Text>
                        <Text className='text-center w-[80px] text-[12px] bg-black text-white py-[5px]' >Buy. Price</Text>
                        {/* ... more header cells */}
                      </View>

                      {/* Data Rows */}
                      <ScrollView nestedScrollEnabled={true} style={{ height: 'calc(100vh - 200px)' }} >
                        {sortedCategorySections.map((section) => (
                          <View className="mb-[2px] flex-row">
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
                                                      <View className="flex-row gap-[4px]">
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
                                                        <TouchableOpacity className='py-[5px] px-[10px] bg-primaryRed border border-[#ffffff]' onPress={() => handleDeleteVariant(groupedItem, variant)}><Text className='text-center text-white' >Delete</Text></TouchableOpacity>
                                                      </View>
                                                    ))}
                                                    {addNewVariantSectionVisibleFor === groupedItem?.id && (
                                                      <View className="flex-row gap-[4px] h-[40px] items-center bg-white">
                                                        <TextInput
                                                          className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px]"
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
                                                          className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px]"
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
                                                <View className="flex-row gap-[4px]">
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
                                                  <TouchableOpacity className='py-[5px] px-[10px] bg-primaryRed border border-[#ffffff]' onPress={() => handleDeleteVariant(item, variant)}><Text className='text-center text-white' >Delete</Text></TouchableOpacity>
                                                </View>
                                              ))}
                                              {addNewVariantSectionVisibleFor === item?.id && (
                                                <View className="flex-row gap-[4px] h-[40px] items-center bg-white">
                                                  <TextInput
                                                    className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px]"
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
                                                    className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px]"
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
                                    className="border border-[#ccc] w-[150px] text-center text-black text-[12px] py-[5px]"
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
        {activeSection === 'category' && (
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
        <View className="absolute inset-0 bg-black bg-opacity-50 justify-center items-center z-50">
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
    </View >
  );
}
