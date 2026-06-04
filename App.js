import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Register service worker for PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Auto-categorization mapping
const CATEGORY_MAP = {
  'Produce': ['apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'carrot', 'broccoli', 'lettuce', 'tomato', 'potato', 'onion', 'garlic', 'pepper', 'cucumber', 'celery', 'spinach', 'kale', 'mushroom', 'avocado'],
  'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs', 'sour cream', 'cottage cheese', 'ice cream'],
  'Meat': ['chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey', 'bacon', 'sausage', 'ham', 'steak', 'ground beef', 'shrimp', 'lamb'],
  'Bakery': ['bread', 'bagel', 'muffin', 'cake', 'cookie', 'croissant', 'roll', 'tortilla', 'pasta', 'rice'],
  'Frozen': ['frozen pizza', 'ice cream', 'frozen vegetables', 'frozen fruit', 'waffles', 'frozen dinner'],
  'Pantry': ['cereal', 'pasta', 'rice', 'canned beans', 'canned tomatoes', 'oil', 'flour', 'sugar', 'salt', 'pepper', 'spices', 'sauce', 'soup'],
  'Beverages': ['water', 'juice', 'soda', 'coffee', 'tea', 'milk', 'beer', 'wine'],
  'Snacks': ['chips', 'crackers', 'nuts', 'cookies', 'candy', 'popcorn', 'granola bar'],
  'Household': ['paper towels', 'toilet paper', 'soap', 'detergent', 'cleaner', 'trash bags', 'sponges'],
  'Other': []
};

const CATEGORY_COLORS = {
  'Produce': '#10b981',
  'Dairy': '#3b82f6',
  'Meat': '#ef4444',
  'Bakery': '#f59e0b',
  'Frozen': '#06b6d4',
  'Pantry': '#8b5cf6',
  'Beverages': '#ec4899',
  'Snacks': '#f97316',
  'Household': '#6b7280',
  'Other': '#9ca3af'
};

const autoCategorize = (itemName) => {
  const lowerName = itemName.toLowerCase();
  for (const [category, items] of Object.entries(CATEGORY_MAP)) {
    if (category === 'Other') continue;
    for (const item of items) {
      if (lowerName.includes(item)) {
        return category;
      }
    }
  }
  return 'Other';
};

export default function App() {
  const [lists, setLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renameListModalVisible, setRenameListModalVisible] = useState(false);
  const [renamingListId, setRenamingListId] = useState(null);
  const [renameListName, setRenameListName] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load lists from AsyncStorage on mount
  useEffect(() => {
    loadLists();
    loadSyncQueue();
    setupNetworkListeners();
  }, []);

  // Save lists to AsyncStorage whenever they change
  useEffect(() => {
    saveLists();
  }, [lists]);

  // Save sync queue to AsyncStorage whenever it changes
  useEffect(() => {
    saveSyncQueue();
  }, [syncQueue]);

  // Setup network status listeners
  const setupNetworkListeners = () => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      
      const handleOnline = () => {
        setIsOnline(true);
        processSyncQueue();
      };
      
      const handleOffline = () => {
        setIsOnline(false);
      };
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  };

  const loadLists = async () => {
    try {
      const storedLists = await AsyncStorage.getItem('shoppingLists');
      if (storedLists) {
        const parsedLists = JSON.parse(storedLists);
        setLists(parsedLists);
        if (parsedLists.length > 0) {
          setCurrentListId(parsedLists[0].id);
        }
      } else {
        // Create default list if none exists
        const defaultList = {
          id: Date.now().toString(),
          name: 'My Shopping List',
          items: []
        };
        setLists([defaultList]);
        setCurrentListId(defaultList.id);
      }
    } catch (error) {
      console.error('Error loading lists:', error);
    }
  };

  const loadSyncQueue = async () => {
    try {
      const storedQueue = await AsyncStorage.getItem('syncQueue');
      if (storedQueue) {
        setSyncQueue(JSON.parse(storedQueue));
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  };

  const saveSyncQueue = async () => {
    try {
      await AsyncStorage.setItem('syncQueue', JSON.stringify(syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  };

  const addToSyncQueue = (mutation) => {
    const queuedMutation = {
      ...mutation,
      timestamp: Date.now(),
      id: `${mutation.type}-${Date.now()}`
    };
    setSyncQueue(prev => [...prev, queuedMutation]);
  };

  const processSyncQueue = async () => {
    if (syncQueue.length === 0 || !isOnline || isSyncing) return;

    setIsSyncing(true);
    const sortedQueue = [...syncQueue].sort((a, b) => a.timestamp - b.timestamp);

    for (const mutation of sortedQueue) {
      try {
        // Here you would sync with your backend API
        // For now, we'll just log it since there's no backend
        console.log('Syncing mutation:', mutation);
        
        // Remove from queue after successful sync
        setSyncQueue(prev => prev.filter(m => m.id !== mutation.id));
      } catch (error) {
        console.error('Error syncing mutation:', mutation, error);
        // Keep in queue for retry
      }
    }

    setIsSyncing(false);
  };

  const saveLists = async () => {
    try {
      await AsyncStorage.setItem('shoppingLists', JSON.stringify(lists));
    } catch (error) {
      console.error('Error saving lists:', error);
    }
  };

  const getCurrentList = () => {
    return lists.find(list => list.id === currentListId);
  };

  const createNewList = () => {
    if (newListName.trim()) {
      const newList = {
        id: Date.now().toString(),
        name: newListName.trim(),
        items: []
      };
      setLists([...lists, newList]);
      setCurrentListId(newList.id);
      setNewListName('');
      setCreateListModalVisible(false);
      
      // Track mutation for sync
      addToSyncQueue({
        type: 'CREATE_LIST',
        data: newList
      });
    }
  };

  const deleteList = (listId) => {
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const listToDelete = lists.find(list => list.id === listId);
            const updatedLists = lists.filter(list => list.id !== listId);
            
            if (updatedLists.length === 0) {
              // Create default list if all lists are deleted
              const defaultList = {
                id: Date.now().toString(),
                name: 'My Shopping List',
                items: []
              };
              setLists([defaultList]);
              setCurrentListId(defaultList.id);
            } else {
              setLists(updatedLists);
              if (currentListId === listId) {
                setCurrentListId(updatedLists[0].id);
              }
            }
            
            // Track mutation for sync
            if (listToDelete) {
              addToSyncQueue({
                type: 'DELETE_LIST',
                data: { listId, list: listToDelete }
              });
            }
          }
        }
      ]
    );
  };

  const renameList = () => {
    if (renameListName.trim() && renamingListId) {
      const oldName = lists.find(list => list.id === renamingListId)?.name;
      setLists(lists.map(list =>
        list.id === renamingListId
          ? { ...list, name: renameListName.trim() }
          : list
      ));
      setRenameListName('');
      setRenamingListId(null);
      setRenameListModalVisible(false);
      
      // Track mutation for sync
      addToSyncQueue({
        type: 'RENAME_LIST',
        data: { listId: renamingListId, oldName, newName: renameListName.trim() }
      });
    }
  };

  const switchList = (listId) => {
    setCurrentListId(listId);
    setEditingPriceId(null);
  };

  const startVoiceInput = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      alert('Speech recognition is not supported in this browser');
    }
  };

  const addItem = () => {
    if (inputText.trim()) {
      const category = autoCategorize(inputText);
      const currentList = getCurrentList();
      if (currentList) {
        const newItem = { 
          id: Date.now().toString(), 
          text: inputText.trim(), 
          completed: false,
          category,
          quantity: '',
          notes: '',
          price: '',
          isEditing: false,
          editName: inputText.trim()
        };
        setLists(lists.map(list =>
          list.id === currentListId
            ? { ...list, items: [...list.items, newItem] }
            : list
        ));
        
        // Track mutation for sync
        addToSyncQueue({
          type: 'ADD_ITEM',
          data: { listId: currentListId, item: newItem }
        });
      }
      setInputText('');
    }
  };

  const toggleItem = (id) => {
    const currentList = getCurrentList();
    const item = currentList?.items.find(i => i.id === id);
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === id ? { ...item, completed: !item.completed } : item
          )}
        : list
    ));
    
    // Track mutation for sync
    if (item) {
      addToSyncQueue({
        type: 'TOGGLE_ITEM',
        data: { listId: currentListId, itemId: id, completed: !item.completed }
      });
    }
  };

  const deleteItem = (id) => {
    const currentList = getCurrentList();
    const item = currentList?.items.find(i => i.id === id);
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.filter(item => item.id !== id) }
        : list
    ));
    
    // Track mutation for sync
    if (item) {
      addToSyncQueue({
        type: 'DELETE_ITEM',
        data: { listId: currentListId, itemId: id, item }
      });
    }
  };

  const toggleEdit = (id) => {
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === id ? { ...item, isEditing: !item.isEditing, editName: item.text } : item
          )}
        : list
    ));
  };

  const saveEdit = (id) => {
    const currentList = getCurrentList();
    const item = currentList?.items.find(i => i.id === id);
    const oldText = item?.text;
    const newText = item?.editName;
    
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === id ? { ...item, isEditing: false, text: item.editName } : item
          )}
        : list
    ));
    
    // Track mutation for sync
    if (oldText !== newText) {
      addToSyncQueue({
        type: 'UPDATE_ITEM',
        data: { listId: currentListId, itemId: id, field: 'text', value: newText }
      });
    }
  };

  const updateEditName = (id, newName) => {
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === id ? { ...item, editName: newName } : item
          )}
        : list
    ));
  };

  const updatePrice = (id, newPrice) => {
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === id ? { ...item, price: newPrice } : item
          )}
        : list
    ));
    
    // Track mutation for sync
    addToSyncQueue({
      type: 'UPDATE_ITEM',
      data: { listId: currentListId, itemId: id, field: 'price', value: newPrice }
    });
  };

  const togglePriceEdit = (id) => {
    setEditingPriceId(editingPriceId === id ? null : id);
  };

  const clearCompleted = () => {
    const currentList = getCurrentList();
    const completedItems = currentList?.items.filter(item => item.completed) || [];
    
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.filter(item => !item.completed) }
        : list
    ));
    
    // Track mutation for sync
    completedItems.forEach(item => {
      addToSyncQueue({
        type: 'DELETE_ITEM',
        data: { listId: currentListId, itemId: item.id, item }
      });
    });
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setQuantity(item.quantity || '');
    setNotes(item.notes || '');
    setPrice(item.price || '');
    setModalVisible(true);
  };

  const saveItemDetails = () => {
    const oldQuantity = editingItem?.quantity || '';
    const oldNotes = editingItem?.notes || '';
    const oldPrice = editingItem?.price || '';
    
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === editingItem.id 
              ? { ...item, quantity: quantity.trim(), notes: notes.trim(), price: price.trim() }
              : item
          )}
        : list
    ));
    
    // Track mutations for sync
    if (quantity.trim() !== oldQuantity) {
      addToSyncQueue({
        type: 'UPDATE_ITEM',
        data: { listId: currentListId, itemId: editingItem.id, field: 'quantity', value: quantity.trim() }
      });
    }
    if (notes.trim() !== oldNotes) {
      addToSyncQueue({
        type: 'UPDATE_ITEM',
        data: { listId: currentListId, itemId: editingItem.id, field: 'notes', value: notes.trim() }
      });
    }
    if (price.trim() !== oldPrice) {
      addToSyncQueue({
        type: 'UPDATE_ITEM',
        data: { listId: currentListId, itemId: editingItem.id, field: 'price', value: price.trim() }
      });
    }
    
    setModalVisible(false);
    setEditingItem(null);
    setQuantity('');
    setNotes('');
    setPrice('');
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity 
        style={styles.itemContent}
        onPress={() => toggleItem(item.id)}
        onLongPress={() => openEditModal(item)}
      >
        <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
          {item.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.itemDetails}>
          {item.isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={item.editName}
                onChangeText={(text) => updateEditName(item.id, text)}
                onSubmitEditing={() => saveEdit(item.id)}
                autoFocus
              />
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={() => saveEdit(item.id)}
              >
                <Text style={styles.saveButtonText}>✓</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => toggleEdit(item.id)}>
              <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]}>
                {item.text}
              </Text>
            </TouchableOpacity>
          )}
          {item.quantity && (
            <Text style={[styles.itemMeta, item.completed && styles.itemTextCompleted]}>
              {item.quantity}
            </Text>
          )}
          {item.notes && (
            <Text style={[styles.itemMeta, item.completed && styles.itemTextCompleted]}>
              {item.notes}
            </Text>
          )}
        </View>
        <View style={styles.priceContainer}>
          {editingPriceId === item.id ? (
            <TextInput
              style={styles.priceInput}
              placeholder="$0.00"
              value={item.price}
              onChangeText={(text) => updatePrice(item.id, text)}
              keyboardType="decimal-pad"
              onSubmitEditing={() => setEditingPriceId(null)}
              autoFocus
              onBlur={() => setEditingPriceId(null)}
            />
          ) : (
            <TouchableOpacity onPress={() => togglePriceEdit(item.id)}>
              <Text style={styles.priceDisplay}>
                {item.price ? `$${item.price}` : '$0.00'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] }]}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => deleteItem(item.id)}
      >
        <Text style={styles.deleteButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const groupItemsByCategory = (itemsToGroup) => {
    const grouped = {};
    itemsToGroup.forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
  };

  const currentList = getCurrentList();
  const currentItems = currentList ? currentList.items : [];
  const activeItems = currentItems.filter(item => !item.completed);
  const completedItems = currentItems.filter(item => item.completed);
  const groupedActiveItems = groupItemsByCategory(activeItems);

  const calculateTotal = (itemsToCalculate) => {
    return itemsToCalculate.reduce((total, item) => {
      const price = parseFloat(item.price) || 0;
      return total + price;
    }, 0);
  };

  const activeTotal = calculateTotal(activeItems);
  const completedTotal = calculateTotal(completedItems);
  const grandTotal = calculateTotal(currentItems);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Smart Shopping List</Text>
        {currentItems.length > 0 && (
          <View style={styles.headerTotal}>
            <Text style={styles.headerTotalLabel}>Total:</Text>
            <Text style={styles.headerTotalValue}>${grandTotal.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Network Status Indicator */}
      <View style={[styles.networkStatus, isOnline ? styles.online : styles.offline]}>
        <Text style={styles.networkStatusText}>
          {isSyncing ? 'Syncing...' : isOnline ? '✓ Online' : '⚠ Offline'}
        </Text>
        {!isOnline && syncQueue.length > 0 && (
          <Text style={styles.queueCount}>{syncQueue.length} pending</Text>
        )}
      </View>

      {/* List Management Section */}
      <View style={styles.listManagement}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.listTabs}>
          {lists.map(list => (
            <TouchableOpacity
              key={list.id}
              style={[styles.listTab, list.id === currentListId && styles.listTabActive]}
              onPress={() => switchList(list.id)}
              onLongPress={() => {
                setRenamingListId(list.id);
                setRenameListName(list.name);
                setRenameListModalVisible(true);
              }}
            >
              <Text style={[styles.listTabText, list.id === currentListId && styles.listTabTextActive]}>
                {list.name}
              </Text>
              <TouchableOpacity
                style={styles.deleteListButton}
                onPress={() => deleteList(list.id)}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <Text style={styles.deleteListButtonText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.createListButton}
          onPress={() => setCreateListModalVisible(true)}
        >
          <Text style={styles.createListButtonText}>+ New List</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add an item..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={addItem}
        />
        <TouchableOpacity 
          style={[styles.voiceButton, isListening && styles.voiceButtonActive]} 
          onPress={startVoiceInput}
        >
          <Text style={styles.voiceButtonText}>{isListening ? '🎤' : '🎤'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer}>
        {Object.keys(groupedActiveItems).length === 0 && completedItems.length === 0 ? (
          <Text style={styles.emptyText}>Your shopping list is empty</Text>
        ) : (
          <>
            {Object.entries(groupedActiveItems).map(([category, categoryItems]) => (
              <View key={category} style={styles.categorySection}>
                <View style={[styles.categoryHeader, { backgroundColor: CATEGORY_COLORS[category] }]}>
                  <Text style={styles.categoryHeaderText}>{category}</Text>
                </View>
                {categoryItems.map(item => (
                  <View key={item.id}>{renderItem({ item })}</View>
                ))}
              </View>
            ))}

            {completedItems.length > 0 && (
              <View style={styles.completedSection}>
                <View style={styles.completedHeader}>
                  <Text style={styles.completedHeaderText}>Completed</Text>
                </View>
                {completedItems.map(item => (
                  <View key={item.id}>{renderItem({ item })}</View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {completedItems.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={clearCompleted}>
          <Text style={styles.clearButtonText}>Clear Completed Items</Text>
        </TouchableOpacity>
      )}

      {/* Create List Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createListModalVisible}
        onRequestClose={() => setCreateListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter list name..."
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setCreateListModalVisible(false);
                  setNewListName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={createNewList}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename List Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={renameListModalVisible}
        onRequestClose={() => setRenameListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter new name..."
              value={renameListName}
              onChangeText={setRenameListName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setRenameListModalVisible(false);
                  setRenameListName('');
                  setRenamingListId(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={renameList}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Item</Text>
            <Text style={styles.modalItemName}>{editingItem?.text}</Text>
            
            <Text style={styles.modalLabel}>Quantity</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., 2 lbs, 1 carton"
              value={quantity}
              onChangeText={setQuantity}
            />
            
            <Text style={styles.modalLabel}>Price</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., 5.99"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
            
            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Add any notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={saveItemDetails}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    maxWidth: 600,
    width: '100%',
    margin: 'auto',
  },
  header: {
    backgroundColor: '#6366f1',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  headerTotal: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  headerTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  headerTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  networkStatus: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  online: {
    backgroundColor: '#d1fae5',
  },
  offline: {
    backgroundColor: '#fee2e2',
  },
  networkStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  queueCount: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 8,
  },
  listManagement: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listTabs: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  listTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  listTabActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  listTabText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginRight: 8,
  },
  listTabTextActive: {
    color: '#fff',
  },
  deleteListButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteListButtonText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 'bold',
  },
  createListButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  createListButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  voiceButton: {
    backgroundColor: '#e5e7eb',
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  voiceButtonActive: {
    backgroundColor: '#ef4444',
  },
  voiceButtonText: {
    fontSize: 20,
  },
  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    height: 50,
    minWidth: 80,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
    padding: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  categoryHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  completedSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#e5e5e5',
  },
  completedHeader: {
    padding: 12,
    backgroundColor: '#9ca3af',
    borderRadius: 8,
    marginBottom: 10,
  },
  completedHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 16,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#10b981',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceContainer: {
    marginRight: 8,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    width: 70,
    textAlign: 'center',
    backgroundColor: '#f9fafb',
  },
  priceDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    minWidth: 70,
    textAlign: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  itemMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 40,
  },
  clearButton: {
    backgroundColor: '#ef4444',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  totalSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 2,
    borderTopColor: '#e5e5e5',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalItemName: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
