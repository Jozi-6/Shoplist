import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [currentView, setCurrentView] = useState('active'); // 'active' or 'history'
  const [history, setHistory] = useState([]);
  const [historyDetailModalVisible, setHistoryDetailModalVisible] = useState(false);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);

  // Load lists and history from AsyncStorage on mount
  useEffect(() => {
    loadLists();
    loadHistory();
  }, []);

  // Save lists to AsyncStorage whenever they change
  useEffect(() => {
    saveLists();
  }, [lists]);

  // Save history to AsyncStorage whenever it changes
  useEffect(() => {
    saveHistory();
  }, [history]);

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

  const loadHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('shoppingHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const saveHistory = async () => {
    try {
      await AsyncStorage.setItem('shoppingHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  const addToHistory = (list) => {
    const historyEntry = {
      id: Date.now().toString(),
      listName: list.name,
      items: [...list.items],
      archivedAt: new Date().toISOString(),
      total: list.items.reduce((sum, item) => {
        if (item.completed) {
          return sum + (parseFloat(item.price) || 0);
        }
        return sum;
      }, 0)
    };
    setHistory(prev => [historyEntry, ...prev]);
  };

  const openHistoryDetail = (entry) => {
    setSelectedHistoryEntry(entry);
    setHistoryDetailModalVisible(true);
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
          }
        }
      ]
    );
  };

  const renameList = () => {
    if (renameListName.trim() && renamingListId) {
      setLists(lists.map(list =>
        list.id === renamingListId
          ? { ...list, name: renameListName.trim() }
          : list
      ));
      setRenameListName('');
      setRenamingListId(null);
      setRenameListModalVisible(false);
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
      const currentList = getCurrentList();
      if (currentList) {
        const newItem = { 
          id: Date.now().toString(), 
          text: inputText.trim(), 
          completed: false,
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
      }
      setInputText('');
    }
  };

  const toggleItem = (id) => {
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === id ? { ...item, completed: !item.completed } : item
          )}
        : list
    ));
  };

  const deleteItem = (id) => {
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.filter(item => item.id !== id) }
        : list
    ));
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
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === id ? { ...item, isEditing: false, text: item.editName } : item
          )}
        : list
    ));
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
  };

  const togglePriceEdit = (id) => {
    setEditingPriceId(editingPriceId === id ? null : id);
  };

  const clearCompleted = () => {
    const currentList = getCurrentList();
    const completedItems = currentList?.items.filter(item => item.completed) || [];
    
    // Add to history before clearing
    if (currentList && completedItems.length > 0) {
      addToHistory(currentList);
    }
    
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.filter(item => !item.completed) }
        : list
    ));
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setQuantity(item.quantity || '');
    setNotes(item.notes || '');
    setPrice(item.price || '');
    setModalVisible(true);
  };

  const saveItemDetails = () => {
    setLists(lists.map(list =>
      list.id === currentListId
        ? { ...list, items: list.items.map(item => 
            item.id === editingItem.id 
              ? { ...item, quantity: quantity.trim(), notes: notes.trim(), price: price.trim() }
              : item
          )}
        : list
    ));
    
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
              placeholder="0.00"
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
                {item.price || '0.00'}
              </Text>
            </TouchableOpacity>
          )}
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

  const currentList = getCurrentList();
  const currentItems = currentList ? currentList.items : [];
  
  // Sort items: unchecked items first, then checked items
  const sortedItems = [...currentItems].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });
  
  const completedItems = currentItems.filter(item => item.completed);

  const calculateTotal = (itemsToCalculate) => {
    return itemsToCalculate.reduce((total, item) => {
      const price = parseFloat(item.price) || 0;
      return total + price;
    }, 0);
  };

  const completedTotal = calculateTotal(completedItems);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>📝</Text>
          </View>
          <Text style={styles.title}>Shopping List</Text>
        </View>
        {completedItems.length > 0 && (
          <View style={styles.headerTotal}>
            <Text style={styles.headerTotalLabel}>Total:</Text>
            <Text style={styles.headerTotalValue}>{completedTotal.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Navigation Tabs */}
      <View style={styles.navigationTabs}>
        <TouchableOpacity
          style={[styles.navTab, currentView === 'active' && styles.navTabActive]}
          onPress={() => setCurrentView('active')}
        >
          <Text style={[styles.navTabText, currentView === 'active' && styles.navTabTextActive]}>
            Active Lists
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navTab, currentView === 'history' && styles.navTabActive]}
          onPress={() => setCurrentView('history')}
        >
          <Text style={[styles.navTabText, currentView === 'history' && styles.navTabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* List Management Section - Only show in active view */}
      {currentView === 'active' && (
        <>
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
            {sortedItems.length === 0 ? (
              <Text style={styles.emptyText}>Your shopping list is empty</Text>
            ) : (
              sortedItems.map(item => (
                <View key={item.id}>{renderItem({ item })}</View>
              ))
            )}
          </ScrollView>

          {completedItems.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearCompleted}>
              <Text style={styles.clearButtonText}>Clear Completed Items</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* History View */}
      {currentView === 'history' && (
        <ScrollView style={styles.listContainer}>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No history yet</Text>
          ) : (
            history.map(entry => (
              <TouchableOpacity
                key={entry.id}
                style={styles.historyItem}
                onPress={() => openHistoryDetail(entry)}
              >
                <View style={styles.historyHeader}>
                  <Text style={styles.historyListName}>{entry.listName}</Text>
                  <Text style={styles.historyTotal}>Total: {entry.total.toFixed(2)}</Text>
                </View>
                <Text style={styles.historyDate}>
                  {new Date(entry.archivedAt).toLocaleDateString()} {new Date(entry.archivedAt).toLocaleTimeString()}
                </Text>
                <Text style={styles.historyItemCount}>{entry.items.length} items</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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

      {/* History Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={historyDetailModalVisible}
        onRequestClose={() => setHistoryDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedHistoryEntry?.listName}</Text>
            <Text style={styles.historyDetailDate}>
              {selectedHistoryEntry && new Date(selectedHistoryEntry.archivedAt).toLocaleDateString()} {selectedHistoryEntry && new Date(selectedHistoryEntry.archivedAt).toLocaleTimeString()}
            </Text>
            <View style={styles.historyDetailTotal}>
              <Text style={styles.historyDetailTotalLabel}>Total:</Text>
              <Text style={styles.historyDetailTotalValue}>{selectedHistoryEntry?.total.toFixed(2)}</Text>
            </View>
            
            <ScrollView style={styles.historyDetailItems}>
              {selectedHistoryEntry?.items.map((item, index) => (
                <View key={index} style={styles.historyDetailItem}>
                  <View style={[styles.historyDetailCheckbox, item.completed && styles.historyDetailCheckboxChecked]}>
                    {item.completed && <Text style={styles.historyDetailCheckmark}>✓</Text>}
                  </View>
                  <View style={styles.historyDetailItemText}>
                    <Text style={[styles.historyDetailItemName, !item.completed && styles.historyDetailItemIncomplete]}>
                      {item.text}
                    </Text>
                    {item.quantity && (
                      <Text style={styles.historyDetailItemMeta}>Qty: {item.quantity}</Text>
                    )}
                    {item.price && (
                      <Text style={styles.historyDetailItemMeta}>Price: {item.price}</Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setHistoryDetailModalVisible(false);
                  setSelectedHistoryEntry(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
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
    padding: 16,
    paddingTop: 50,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoContainer: {
    marginRight: 10,
  },
  logoIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerTotal: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  headerTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 6,
  },
  headerTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  navigationTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  navTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navTabActive: {
    borderBottomColor: '#6366f1',
  },
  navTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  navTabTextActive: {
    color: '#6366f1',
  },
  listManagement: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  listTabs: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  listTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  listTabActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  listTabText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    marginRight: 6,
  },
  listTabTextActive: {
    color: '#fff',
  },
  deleteListButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  deleteListButtonText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 'bold',
  },
  createListButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  createListButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 15,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  voiceButton: {
    backgroundColor: '#e5e7eb',
    width: 44,
    height: 44,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  voiceButtonActive: {
    backgroundColor: '#ef4444',
  },
  voiceButtonText: {
    fontSize: 18,
  },
  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    height: 44,
    minWidth: 70,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
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
    marginLeft: 10,
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
    fontSize: 15,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#10b981',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  priceContainer: {
    marginRight: 6,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 13,
    width: 60,
    textAlign: 'center',
    backgroundColor: '#f9fafb',
  },
  priceDisplay: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    minWidth: 60,
    textAlign: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemText: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  itemMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 40,
  },
  clearButton: {
    backgroundColor: '#ef4444',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  historyItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyListName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  historyTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  historyDate: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 3,
  },
  historyItemCount: {
    fontSize: 13,
    color: '#9ca3af',
  },
  historyDetailDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  historyDetailTotal: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  historyDetailTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
  },
  historyDetailTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  historyDetailItems: {
    maxHeight: 300,
    marginBottom: 16,
  },
  historyDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  historyDetailCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyDetailCheckboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  historyDetailCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  historyDetailItemText: {
    flex: 1,
  },
  historyDetailItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  historyDetailItemIncomplete: {
    color: '#ef4444',
    fontStyle: 'italic',
  },
  historyDetailItemMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
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
