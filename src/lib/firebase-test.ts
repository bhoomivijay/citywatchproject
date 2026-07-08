// Firebase connectivity test
import { auth, db } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';

export async function testFirebaseConnection() {
  console.log('🧪 Testing Firebase connection...');
  
  try {
    // Test 1: Check if auth is working
    console.log('Testing Auth service...');
    const authResult = await signInAnonymously(auth);
    console.log('✅ Auth test passed:', authResult.user.uid);
    
    // Test 2: Check if Firestore is working
    console.log('Testing Firestore service...');
    const testCollection = collection(db, 'test');
    const snapshot = await getDocs(testCollection);
    console.log('✅ Firestore test passed, collections accessible');
    
    // Clean up test user
    await authResult.user.delete();
    console.log('✅ Test user cleaned up');
    
    return { success: true, message: 'Firebase is working correctly' };
  } catch (error: any) {
    console.error('❌ Firebase test failed:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      details: error
    };
  }
}
