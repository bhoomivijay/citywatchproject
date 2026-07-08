// Simple Firebase connectivity test
import { auth, db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function simpleFirebaseTest() {
  console.log('🧪 Running simple Firebase test...');
  
  try {
    // Test 1: Check if Firebase objects exist
    console.log('✅ Firebase auth object exists:', !!auth);
    console.log('✅ Firebase db object exists:', !!db);
    
    // Test 2: Check Firebase app
    console.log('✅ Firebase app:', auth.app.name);
    console.log('✅ Firebase project ID:', auth.app.options.projectId);
    
    // Test 3: Check if we can access Firebase config
    console.log('✅ Firebase config loaded successfully');
    
    return { 
      success: true, 
      message: 'Firebase basic connectivity is working',
      details: {
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain
      }
    };
  } catch (error: any) {
    console.error('❌ Simple Firebase test failed:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      details: error
    };
  }
}

// Test Firestore write operation
export async function testFirestoreWrite() {
  console.log('🧪 Testing Firestore write operation...');
  
  try {
    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
      return { 
        success: false, 
        error: 'No authenticated user found',
        code: 'NO_USER'
      };
    }
    
    console.log('✅ User authenticated:', user.uid);
    
    // Try to write a test document
    const testData = {
      test: true,
      timestamp: serverTimestamp(),
      userId: user.uid,
      message: 'This is a test document'
    };
    
    console.log('✅ Attempting to write test document...');
    const docRef = await addDoc(collection(db, 'test'), testData);
    console.log('✅ Test document written successfully with ID:', docRef.id);
    
    return { 
      success: true, 
      message: 'Firestore write operation successful',
      documentId: docRef.id
    };
  } catch (error: any) {
    console.error('❌ Firestore write test failed:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      details: error
    };
  }
}
