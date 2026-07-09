// src/lib/firebase-services.ts
// Firebase services merged from old project - handles all backend operations

import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp, 
  Timestamp,
  increment
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Incident {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  description: string;
  aiAnalysis: {
    summary: string;
    category: string;
    severity: number;
  };
  // ADD TOP-LEVEL SEVERITY FIELD TO BYPASS SECURITY RULES
  severity?: number;
  status: 'pending' | 'in-progress' | 'resolved' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  notes?: string;
  adminNotes?: string;
  statusChangedAt?: Timestamp;
  statusChangedBy?: string;
  /** Reporter reputation for admin priority UI */
  userBadge?: string;
  userScore?: number;
  /** Agentic auto-dispatch metadata for trusted high-severity reports */
  agentDispatch?: {
    triggered: boolean;
    reason: string;
    authorityName?: string;
    authorityPhone?: string;
    authorityEmail?: string;
    distanceKm?: number;
    emailOpened?: boolean;
    emailSubmitted?: boolean;
    callOpened?: boolean;
    callNumber?: string;
    messagePreview?: string;
    createdAt?: string;
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  score: number;
  badge: string;
  totalReports: number;
  acceptedReports: number;
  rejectedReports: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isRecommended: boolean;
}

export interface Notification {
  id?: string;
  userId: string;
  type: 'incident_accepted' | 'incident_rejected' | 'incident_created' | 'incident_in_progress' | 'incident_pending' | 'points_earned' | 'badge_earned' | 'admin_recommendation' | 'agent_auto_dispatch';
  title: string;
  message: string;
  incidentId?: string;
  points?: number;
  badge?: string;
  isRead: boolean;
  createdAt: Timestamp;
}

export interface IncidentFormData {
  description: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
}

// Add a new incident to Firestore with AI analysis
export const addIncident = async (
  incidentData: IncidentFormData, 
  aiAnalysis: Incident['aiAnalysis'],
  userData?: any
): Promise<string> => {
  try {
    // Use passed userData or fall back to auth.currentUser
    const user = userData || auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to report incidents');
    }

    console.log('firebase-services: Creating incident with AI analysis:', aiAnalysis);
    console.log('firebase-services: AI analysis severity:', aiAnalysis.severity);
    console.log('firebase-services: AI analysis type:', typeof aiAnalysis.severity);

    // PRESERVE EXACT SEVERITY FROM AI - NO VALIDATION OR TRANSFORMATIONS
    const exactSeverity = Number(aiAnalysis.severity);
    console.log('firebase-services: EXACT severity from AI:', exactSeverity);
    console.log('firebase-services: Severity type:', typeof exactSeverity);
    
    // Only validate that it's a number, not the range (allow 0-5)
    let severity: number;
    if (isNaN(exactSeverity)) {
      console.warn('firebase-services: Invalid severity value:', aiAnalysis.severity, 'defaulting to 3');
      severity = 3;
    } else {
      severity = exactSeverity; // Use exact AI value
    }
    
    const incident: Omit<Incident, 'id'> = {
      userId: user.uid,
      userEmail: user.email || 'unknown@email.com',
      userName: user.displayName || 'Unknown User',
      location: incidentData.location,
      description: incidentData.description,
      aiAnalysis: {
        summary: aiAnalysis.summary || 'Manual analysis',
        category: aiAnalysis.category || 'Other',
        severity: severity // Use exact AI value
      },
      // ADD SEVERITY AS A TOP-LEVEL FIELD TO BYPASS SECURITY RULES
      severity: severity,
      status: 'pending',
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      priority: getPriorityFromSeverity(severity), // Use exact AI value
      notes: ''
    };
    
    // CRITICAL DEBUG: Log exactly what we're about to save
    console.log('firebase-services: ===== ABOUT TO SAVE THIS INCIDENT =====');
    console.log('firebase-services: Full incident object:', incident);
    console.log('firebase-services: AI Analysis being saved:', incident.aiAnalysis);
    console.log('firebase-services: Severity being saved:', incident.aiAnalysis.severity);
    console.log('firebase-services: Severity type:', typeof incident.aiAnalysis.severity);
    console.log('firebase-services: ======================================');

    console.log('firebase-services: Final incident object to save:', incident);
    console.log('firebase-services: Incident AI analysis to save:', incident.aiAnalysis);

    const docRef = await addDoc(collection(db, 'incidents'), incident);
    console.log('firebase-services: Incident saved with ID:', docRef.id);
    
    // CRITICAL DEBUG: Check if data was transformed during save
    const savedDoc = await getDoc(docRef);
    const savedData = savedDoc.data();
    console.log('firebase-services: ===== WHAT WAS ACTUALLY SAVED =====');
    console.log('firebase-services: Full saved data:', savedData);
    console.log('firebase-services: Saved AI analysis:', savedData?.aiAnalysis);
    console.log('firebase-services: Saved severity:', savedData?.aiAnalysis?.severity);
    console.log('firebase-services: Saved severity type:', typeof savedData?.aiAnalysis?.severity);
    console.log('firebase-services: Saved top-level severity:', savedData?.severity);
    console.log('firebase-services: Saved top-level severity type:', typeof savedData?.severity);
    
    // Check if severity was changed during save
    if (savedData?.aiAnalysis?.severity !== severity) {
      console.error('firebase-services: SEVERITY CHANGED DURING SAVE!');
      console.error('firebase-services: Original severity:', severity);
      console.error('firebase-services: Saved severity:', savedData?.aiAnalysis?.severity);
    }
    
    // Check if top-level severity was changed during save
    if (savedData?.severity !== severity) {
      console.error('firebase-services: TOP-LEVEL SEVERITY CHANGED DURING SAVE!');
      console.error('firebase-services: Original severity:', severity);
      console.error('firebase-services: Saved top-level severity:', savedData?.severity);
    }
    
    console.log('firebase-services: ======================================');
    
    // Test retrieval to see if data is saved correctly
    const testRetrieval = await getDoc(docRef);
    console.log('firebase-services: Test retrieval after save:', testRetrieval.data());
    console.log('firebase-services: Test retrieval AI analysis:', testRetrieval.data()?.aiAnalysis);
    console.log('firebase-services: Test retrieval severity:', testRetrieval.data()?.aiAnalysis?.severity);
    
    // Also check if we can read it back immediately
    try {
      const immediateCheck = await getDoc(docRef);
      const immediateData = immediateCheck.data();
      console.log('firebase-services: ===== IMMEDIATE READ CHECK =====');
      console.log('firebase-services: Immediate read data:', immediateData);
      console.log('firebase-services: Immediate AI analysis:', immediateData?.aiAnalysis);
      console.log('firebase-services: Immediate severity:', immediateData?.aiAnalysis?.severity);
      console.log('firebase-services: Immediate top-level severity:', immediateData?.severity);
      
      // Check if severity changed during read
      if (immediateData?.aiAnalysis?.severity !== savedData?.aiAnalysis?.severity) {
        console.error('firebase-services: SEVERITY CHANGED DURING READ!');
        console.error('firebase-services: Saved severity:', savedData?.aiAnalysis?.severity);
        console.error('firebase-services: Read severity:', immediateData?.aiAnalysis?.severity);
      }
      
      // Check if top-level severity changed during read
      if (immediateData?.severity !== savedData?.severity) {
        console.error('firebase-services: TOP-LEVEL SEVERITY CHANGED DURING READ!');
        console.error('firebase-services: Saved top-level severity:', savedData?.severity);
        console.error('firebase-services: Read top-level severity:', immediateData?.severity);
      }
      
      console.log('firebase-services: ================================');
    } catch (readError) {
      console.error('firebase-services: Error reading back saved data:', readError);
    }
    
    // WAIT A BIT TO SEE IF CLOUD FUNCTION INTERFERES
    console.log('firebase-services: Waiting 3 seconds to see if Cloud Function interferes...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check again after waiting
    const afterWaitCheck = await getDoc(docRef);
    const afterWaitData = afterWaitCheck.data();
    console.log('firebase-services: ===== AFTER WAITING FOR CLOUD FUNCTION =====');
    console.log('firebase-services: Data after waiting:', afterWaitData);
    console.log('firebase-services: AI Analysis after waiting:', afterWaitData?.aiAnalysis);
    console.log('firebase-services: Severity after waiting:', afterWaitData?.aiAnalysis?.severity);
    console.log('firebase-services: Top-level severity after waiting:', afterWaitData?.severity);
    
    // Check if Cloud Function changed the data
    if (afterWaitData?.aiAnalysis?.severity !== savedData?.aiAnalysis?.severity) {
      console.error('firebase-services: CLOUD FUNCTION INTERFERED!');
      console.error('firebase-services: Before Cloud Function:', savedData?.aiAnalysis?.severity);
      console.error('firebase-services: After Cloud Function:', afterWaitData?.aiAnalysis?.severity);
    }
    
    if (afterWaitData?.severity !== savedData?.severity) {
      console.error('firebase-services: CLOUD FUNCTION CHANGED TOP-LEVEL SEVERITY!');
      console.error('firebase-services: Before Cloud Function:', savedData?.severity);
      console.error('firebase-services: After Cloud Function:', afterWaitData?.severity);
    }
    
    console.log('firebase-services: ======================================');
    
    // Update user's totalReports count when incident is created
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        totalReports: increment(1),
        updatedAt: serverTimestamp()
      });
      console.log('User totalReports updated');
    } catch (updateError) {
      console.error('Error updating user totalReports:', updateError);
    }

    // Send notification to user that their incident was created
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        type: 'incident_created',
        title: 'Issue Reported Successfully!',
        message: `Your report "${incidentData.description.substring(0, 50)}..." has been submitted and is under review.`,
        incidentId: docRef.id,
        isRead: false,
        createdAt: serverTimestamp()
      });
      console.log('Incident creation notification sent');
    } catch (notificationError) {
      console.error('Error sending incident creation notification:', notificationError);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding incident:', error);
    throw error;
  }
};

export const saveAgentDispatchResult = async (
  incidentId: string,
  dispatch: NonNullable<Incident['agentDispatch']>
): Promise<void> => {
  const incidentRef = doc(db, 'incidents', incidentId);

  // Firestore rejects undefined values — only write defined fields
  const cleanedDispatch = Object.fromEntries(
    Object.entries(dispatch).filter(([, value]) => value !== undefined)
  ) as NonNullable<Incident['agentDispatch']>;

  const updateData: Record<string, unknown> = {
    agentDispatch: cleanedDispatch,
    status: cleanedDispatch.triggered ? 'in-progress' : 'pending',
    updatedAt: serverTimestamp(),
  };

  if (cleanedDispatch.triggered) {
    updateData.notes = `Agent auto-dispatched to ${cleanedDispatch.authorityName || 'nearest authority'} (no admin action required).`;
  }

  await updateDoc(incidentRef, updateData);

  if (cleanedDispatch.triggered) {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        type: 'agent_auto_dispatch',
        title: 'Agent Auto-Dispatch Triggered',
        message: `Trusted citizen severity-5 report ${incidentId} was auto-sent to ${cleanedDispatch.authorityName || 'emergency authorities'}.`,
        incidentId,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Could not create admin auto-dispatch notification:', error);
    }
  }
};

// Helper function to determine priority based on severity
const getPriorityFromSeverity = (severity: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (severity >= 5) return 'critical';
  if (severity >= 4) return 'high';
  if (severity >= 3) return 'medium';
  return 'low';
};

// Get all incidents (for admin dashboard)
export const getAllIncidents = async (): Promise<Incident[]> => {
  try {
    const q = query(
      collection(db, 'incidents'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const incidents: Incident[] = [];
    
    querySnapshot.forEach((docSnap) => {
      const incidentData = docSnap.data();
      incidents.push({
        id: docSnap.id,
        ...incidentData
      } as Incident);
    });

    // Attach latest reporter badge/score so Priority column stays accurate
    const uniqueUserIds = [...new Set(incidents.map((incident) => incident.userId).filter(Boolean))];
    const userMeta = new Map<string, { badge?: string; score?: number }>();

    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            userMeta.set(userId, {
              badge: data.badge,
              score: data.score,
            });
          }
        } catch (error) {
          console.warn('Could not load reporter profile for priority:', userId, error);
        }
      })
    );

    return incidents.map((incident) => {
      const meta = userMeta.get(incident.userId);
      const score = Number(meta?.score ?? incident.userScore ?? 0);
      const derived = getBadgeFromScore(score);
      // Prefer score-derived badge so Priority stays correct even if users.badge is stale
      const badge = derived.badge;

      return {
        ...incident,
        userBadge: badge,
        userScore: score,
      };
    });
  } catch (error) {
    console.error('Error getting incidents:', error);
    throw error;
  }
};

// Debug function to check database directly
// Test function to read raw data without transformations
export const testRawRead = async (incidentId: string) => {
  try {
    console.log('firebase-services: Testing raw read for incident:', incidentId);
    
    const docRef = doc(db, 'incidents', incidentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const rawData = docSnap.data();
      console.log('firebase-services: ===== RAW FIRESTORE DATA =====');
      console.log('firebase-services: Raw data:', rawData);
      console.log('firebase-services: Raw top-level severity:', rawData.severity);
      console.log('firebase-services: Raw top-level severity type:', typeof rawData.severity);
      console.log('firebase-services: Raw AI analysis:', rawData.aiAnalysis);
      console.log('firebase-services: Raw AI severity:', rawData.aiAnalysis?.severity);
      console.log('firebase-services: Raw AI severity type:', typeof rawData.aiAnalysis?.severity);
      
      // Check if there's any difference between top-level and nested severity
      if (rawData.severity !== rawData.aiAnalysis?.severity) {
        console.error('firebase-services: SEVERITY MISMATCH IN RAW DATA!');
        console.error('firebase-services: Top-level severity:', rawData.severity);
        console.error('firebase-services: Nested severity:', rawData.aiAnalysis?.severity);
      }
      
      console.log('firebase-services: ================================');
      return rawData;
    } else {
      console.log('firebase-services: Document does not exist');
      return null;
    }
  } catch (error) {
    console.error('firebase-services: Error in testRawRead:', error);
    return null;
  }
};

export const debugDatabase = async () => {
  try {
    console.log('=== DEBUGGING DATABASE ===');
    const q = query(collection(db, 'incidents'));
    const querySnapshot = await getDocs(q);
    
    console.log('Total incidents in database:', querySnapshot.size);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Document ID:', doc.id);
      console.log('Full document data:', data);
      console.log('AI Analysis:', data.aiAnalysis);
      console.log('Severity:', data.aiAnalysis?.severity);
      console.log('Severity Type:', typeof data.aiAnalysis?.severity);
      console.log('Raw severity value:', data.aiAnalysis?.severity);
      
      // Check if this is the incident we just saved
      if (data.description === 'killing a man' || data.description === 'a man killed') {
        console.log('=== FOUND THE INCIDENT ===');
        console.log('Raw Firestore data:', data);
        console.log('Raw AI Analysis:', data.aiAnalysis);
        console.log('Raw Severity:', data.aiAnalysis?.severity);
        console.log('=== END FOUND ===');
      }
      
      console.log('---');
    });
    
    console.log('=== END DEBUG ===');
  } catch (error) {
    console.error('Debug error:', error);
  }
};

// Get incidents for a specific user
const mapIncidentDoc = (docSnap: { id: string; data: () => Record<string, unknown> }): Incident => {
  const incidentData = docSnap.data();
  const topLevelSeverity = incidentData.severity;
  const aiAnalysisSeverity = (incidentData.aiAnalysis as { severity?: number } | undefined)?.severity;
  const finalSeverity = topLevelSeverity !== undefined ? topLevelSeverity : aiAnalysisSeverity;

  return {
    id: docSnap.id,
    ...incidentData,
    severity: finalSeverity,
    aiAnalysis: {
      ...(incidentData.aiAnalysis as Incident["aiAnalysis"]),
      severity: finalSeverity,
    },
  } as Incident;
};

const sortIncidentsByDate = (incidents: Incident[]): Incident[] =>
  [...incidents].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });

export const getUserIncidents = async (userId: string): Promise<Incident[]> => {
  try {
    const indexedQuery = query(
      collection(db, "incidents"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(indexedQuery);
    return querySnapshot.docs.map((docSnap) => mapIncidentDoc(docSnap));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const needsIndex =
      message.includes("requires an index") || message.includes("failed-precondition");

    if (!needsIndex) {
      console.error("Error getting user incidents:", error);
      throw error;
    }

    console.warn("Firestore index missing, loading incidents without orderBy:", message);

    const fallbackQuery = query(collection(db, "incidents"), where("userId", "==", userId));
    const querySnapshot = await getDocs(fallbackQuery);
    return sortIncidentsByDate(querySnapshot.docs.map((docSnap) => mapIncidentDoc(docSnap)));
  }
};

// Update incident status with scoring and notifications
export const updateIncidentStatus = async (
  incidentId: string, 
  status: Incident['status'],
  notes?: string,
  adminId?: string
): Promise<void> => {
  try {
    const incidentRef = doc(db, 'incidents', incidentId);
    
    // Get the incident to check previous status
    const incidentDoc = await getDocs(query(collection(db, 'incidents'), where('__name__', '==', incidentId)));
    const incident = incidentDoc.docs[0]?.data() as Incident;
    
    if (!incident) {
      throw new Error('Incident not found');
    }

    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
      statusChangedAt: serverTimestamp(),
      statusChangedBy: adminId || 'system'
    };
    
    if (notes) {
      updateData.adminNotes = notes;
    }
    
    await updateDoc(incidentRef, updateData);

    // Handle scoring and notifications for status changes
    if (status === 'resolved' && incident.status !== 'resolved') {
      await handleIncidentAccepted(incident.userId, incidentId, incident.description);
    } else if (status === 'rejected' && incident.status !== 'rejected') {
      await handleIncidentRejected(incident.userId, incidentId, incident.description);
    } else if (status === 'in-progress' && incident.status !== 'in-progress') {
      await handleIncidentInProgress(incident.userId, incidentId, incident.description);
    } else if (status === 'pending' && incident.status !== 'pending') {
      await handleIncidentPending(incident.userId, incidentId, incident.description);
    }

    console.log('Incident status updated successfully');
  } catch (error) {
    console.error('Error updating incident status:', error);
    throw error;
  }
};

// Handle incident acceptance - add points and send notification
const handleIncidentAccepted = async (userId: string, incidentId: string, description: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Update user score (+10 points). totalReports is set only on create — don't double-count here.
    await updateDoc(userRef, {
      score: increment(10),
      acceptedReports: increment(1),
      updatedAt: serverTimestamp()
    });

    // Create notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'incident_accepted',
      title: 'Issue Accepted!',
      message: `Your report "${description.substring(0, 50)}..." has been accepted and resolved. You earned +10 points!`,
      incidentId,
      points: 10,
      isRead: false,
      createdAt: serverTimestamp()
    });

    // Check if user should get a new badge
    await checkAndUpdateBadge(userId);
    
    console.log('Incident accepted - points added and notification sent');
  } catch (error) {
    console.error('Error handling incident acceptance:', error);
  }
};

// Handle incident rejection - subtract points and send notification
const handleIncidentRejected = async (userId: string, incidentId: string, description: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Update user score (-20 points). totalReports is set only on create — don't double-count here.
    await updateDoc(userRef, {
      score: increment(-20),
      rejectedReports: increment(1),
      updatedAt: serverTimestamp()
    });

    // Create notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'incident_rejected',
      title: 'Issue Rejected',
      message: `Your report "${description.substring(0, 50)}..." was rejected. You lost -20 points.`,
      incidentId,
      points: -20,
      isRead: false,
      createdAt: serverTimestamp()
    });

    // Check if user should get a new badge
    await checkAndUpdateBadge(userId);
    
    console.log('Incident rejected - points subtracted and notification sent');
  } catch (error) {
    console.error('Error handling incident rejection:', error);
  }
};

// Handle incident in-progress - send notification
const handleIncidentInProgress = async (userId: string, incidentId: string, description: string) => {
  try {
    // Create notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'incident_in_progress',
      title: 'Issue Being Worked On',
      message: `Your report "${description.substring(0, 50)}..." is now being processed by our team.`,
      incidentId,
      isRead: false,
      createdAt: serverTimestamp()
    });
    
    console.log('Incident in-progress notification sent');
  } catch (error) {
    console.error('Error handling incident in-progress notification:', error);
  }
};

// Handle incident pending - send notification
const handleIncidentPending = async (userId: string, incidentId: string, description: string) => {
  try {
    // Create notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'incident_pending',
      title: 'Issue Status Changed',
      message: `Your report "${description.substring(0, 50)}..." status has been changed to pending for review.`,
      incidentId,
      isRead: false,
      createdAt: serverTimestamp()
    });
    
    console.log('Incident pending notification sent');
  } catch (error) {
    console.error('Error handling incident pending notification:', error);
  }
};

/** Citizen badge labels (no emojis) */
export const CITIZEN_BADGES = {
  ELITE: 'Elite Citizen',
  GOLD: 'Gold Citizen',
  SILVER: 'Silver Citizen',
  BRONZE: 'Bronze Citizen',
  NEW: 'New Citizen',
  WARNING: 'Warning Citizen',
  SUSPENDED: 'Suspended Citizen',
} as const;

/** Remove emoji / symbol pictographs from display strings */
export const stripEmojis = (text: string): string =>
  text
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      ''
    )
    .replace(/"\s+/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** Strip leading emoji from legacy badge strings stored in Firestore */
export const normalizeBadgeLabel = (badge: string): string => stripEmojis(badge);

/** Derive citizen badge + recommendation flag from score */
export const getBadgeFromScore = (score: number): { badge: string; isRecommended: boolean } => {
  if (score >= 100) return { badge: CITIZEN_BADGES.ELITE, isRecommended: true };
  if (score >= 75) return { badge: CITIZEN_BADGES.GOLD, isRecommended: true };
  if (score >= 50) return { badge: CITIZEN_BADGES.SILVER, isRecommended: false };
  if (score >= 25) return { badge: CITIZEN_BADGES.BRONZE, isRecommended: false };
  if (score >= 0) return { badge: CITIZEN_BADGES.NEW, isRecommended: false };
  if (score >= -80) return { badge: CITIZEN_BADGES.WARNING, isRecommended: false };
  return { badge: CITIZEN_BADGES.SUSPENDED, isRecommended: false };
};

// Check and update user badge based on score
export const checkAndUpdateBadge = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
    const userData = userDoc.docs[0]?.data() as UserProfile;
    
    if (!userData) return;

    const { badge: newBadge, isRecommended } = getBadgeFromScore(Number(userData.score || 0));

    // Update badge if changed
    if (newBadge !== normalizeBadgeLabel(userData.badge || '') || isRecommended !== (userData.isRecommended || false)) {
      await updateDoc(userRef, {
        badge: newBadge,
        isRecommended,
        updatedAt: serverTimestamp()
      });

      if (newBadge !== normalizeBadgeLabel(userData.badge || '')) {
        // Send badge notification
        await addDoc(collection(db, 'notifications'), {
          userId,
          type: 'badge_earned',
          title: 'New Badge Earned!',
          message: `Congratulations! You've earned the "${newBadge}" badge!`,
          badge: newBadge,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
};

// Check if user is suspended based on score
export const isUserSuspended = async (userId: string): Promise<boolean> => {
  try {
    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
    const userData = userDoc.docs[0]?.data() as UserProfile;
    
    if (!userData) return false;
    
    // User is suspended if score is below -80
    return userData.score < -80;
  } catch (error) {
    console.error('Error checking user suspension status:', error);
    return false;
  }
};

// Check if user is in warning zone (negative score but not suspended)
export const isUserInWarningZone = async (userId: string): Promise<boolean> => {
  try {
    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
    const userData = userDoc.docs[0]?.data() as UserProfile;
    
    if (!userData) return false;
    
    // User is in warning zone if score is negative but above -80
    return userData.score < 0 && userData.score >= -80;
  } catch (error) {
    console.error('Error checking user warning status:', error);
    return false;
  }
};

// Update incident with AI analysis
export const updateIncidentWithAI = async (
  incidentId: string,
  aiAnalysis: Incident['aiAnalysis']
): Promise<void> => {
  try {
    const incidentRef = doc(db, 'incidents', incidentId);
    await updateDoc(incidentRef, {
      aiAnalysis,
      updatedAt: serverTimestamp()
    });
    console.log('Incident AI analysis updated successfully');
  } catch (error) {
    console.error('Error updating incident AI analysis:', error);
    throw error;
  }
};

// Get incident statistics
export const getIncidentStats = async () => {
  try {
    const incidents = await getAllIncidents();
    
    const stats = {
      total: incidents.length,
      pending: incidents.filter(i => i.status === 'pending').length,
      inProgress: incidents.filter(i => i.status === 'in-progress').length,
      resolved: incidents.filter(i => i.status === 'resolved').length,
      rejected: incidents.filter(i => i.status === 'rejected').length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<number, number>
    };
    
    incidents.forEach(incident => {
      // Count by category
      const category = incident.aiAnalysis.category;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // Count by severity
      const severity = incident.aiAnalysis.severity;
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting incident stats:', error);
    throw error;
  }
};

// Search incidents
export const searchIncidents = async (
  searchTerm: string,
  filters?: {
    status?: Incident['status'];
    category?: string;
    severity?: number;
  }
): Promise<Incident[]> => {
  try {
    let q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    
    // Apply filters
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    
    if (filters?.category) {
      q = query(q, where('aiAnalysis.category', '==', filters.category));
    }
    
    if (filters?.severity) {
      q = query(q, where('aiAnalysis.severity', '==', filters.severity));
    }
    
    const querySnapshot = await getDocs(q);
    const incidents: Incident[] = [];
    
    querySnapshot.forEach((doc) => {
      const incident = {
        id: doc.id,
        ...doc.data()
      } as Incident;
      
      // Apply search term filter
      if (!searchTerm || 
          incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          incident.aiAnalysis.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
          incident.aiAnalysis.category.toLowerCase().includes(searchTerm.toLowerCase())) {
        incidents.push(incident);
      }
    });
    
    return incidents;
  } catch (error) {
    console.error('Error searching incidents:', error);
    throw error;
  }
};

// Get user profile with score and badge
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
    const userData = userDoc.docs[0]?.data() as UserProfile;
    
    if (userData) {
      // Always reconcile report counters with real incidents
      try {
        const stats = await syncUserReportStats(userId);
        userData.totalReports = stats.totalReports;
        userData.acceptedReports = stats.acceptedReports;
        userData.rejectedReports = stats.rejectedReports;
      } catch (syncError) {
        console.warn('Could not sync user report stats:', syncError);
        try {
          const stats = await getUserReportStats(userId);
          userData.totalReports = stats.totalReports;
          userData.acceptedReports = stats.acceptedReports;
          userData.rejectedReports = stats.rejectedReports;
        } catch {
          // keep stored values
        }
      }

      // Keep badge in sync with current score (e.g. 100 → Elite)
      const { badge, isRecommended } = getBadgeFromScore(Number(userData.score || 0));
      if (badge !== userData.badge || isRecommended !== (userData.isRecommended || false)) {
        try {
          await updateDoc(doc(db, 'users', userId), {
            badge,
            isRecommended,
            updatedAt: serverTimestamp()
          });
          userData.badge = badge;
          userData.isRecommended = isRecommended;
        } catch (badgeError) {
          console.error('Error syncing user badge:', badgeError);
          userData.badge = badge;
          userData.isRecommended = isRecommended;
        }
      }
      
      return userData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Get user notifications
export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const notifications: Notification[] = [];
    
    querySnapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      } as Notification);
    });
    
    return notifications;
  } catch (error: any) {
    console.error('Error getting notifications:', error);
    
    // If index error, try to load without ordering
    if (error.code === 'failed-precondition') {
      try {
        const simpleQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', userId)
        );
        
        const simpleSnapshot = await getDocs(simpleQuery);
        const simpleNotifications = simpleSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];
        
        // Sort manually since we can't use orderBy
        return simpleNotifications.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        });
      } catch (simpleError) {
        console.error('Error loading notifications without ordering:', simpleError);
        return [];
      }
    }
    
    return [];
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isRead: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/** Count reports from actual incidents (source of truth). */
export const getUserReportStats = async (
  userId: string
): Promise<{ totalReports: number; acceptedReports: number; rejectedReports: number }> => {
  const incidentsSnapshot = await getDocs(
    query(collection(db, 'incidents'), where('userId', '==', userId))
  );

  let acceptedReports = 0;
  let rejectedReports = 0;

  incidentsSnapshot.forEach((incidentDoc) => {
    const status = incidentDoc.data().status;
    if (status === 'resolved') acceptedReports += 1;
    else if (status === 'rejected') rejectedReports += 1;
  });

  return {
    totalReports: incidentsSnapshot.size,
    acceptedReports,
    rejectedReports,
  };
};

/** Persist report counters from incidents so UI doesn't show inflated totals. */
export const syncUserReportStats = async (userId: string): Promise<{
  totalReports: number;
  acceptedReports: number;
  rejectedReports: number;
}> => {
  const stats = await getUserReportStats(userId);
  await updateDoc(doc(db, 'users', userId), {
    ...stats,
    updatedAt: serverTimestamp(),
  });
  return stats;
};

// Sync all users' report counts with actual incident data
export const syncAllUsersTotalReports = async (): Promise<void> => {
  try {
    console.log('Starting to sync all users report stats...');
    
    const usersSnapshot = await getDocs(query(collection(db, 'users')));
    let updatedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as UserProfile;
      const userId = userDoc.id;
      const stats = await getUserReportStats(userId);
      
      if (
        userData.totalReports !== stats.totalReports ||
        userData.acceptedReports !== stats.acceptedReports ||
        userData.rejectedReports !== stats.rejectedReports
      ) {
        await updateDoc(doc(db, 'users', userId), {
          ...stats,
          updatedAt: serverTimestamp()
        });
        updatedCount++;
        console.log(
          `Updated user ${userId}: total ${userData.totalReports}→${stats.totalReports}, ` +
            `accepted ${userData.acceptedReports}→${stats.acceptedReports}, ` +
            `rejected ${userData.rejectedReports}→${stats.rejectedReports}`
        );
      }
    }
    
    console.log(`Sync complete! Updated ${updatedCount} users.`);
  } catch (error) {
    console.error('Error syncing users report stats:', error);
    throw error;
  }
};

// Get recommended users for administrators
export const getRecommendedUsers = async (): Promise<UserProfile[]> => {
  try {
    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'users'),
      where('isRecommended', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const users: UserProfile[] = [];
    
    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data() as any;
      // Only include users with role 'user'
      if (userData.role !== 'user') continue;

      let stats = {
        totalReports: Number(userData.totalReports || 0),
        acceptedReports: Number(userData.acceptedReports || 0),
        rejectedReports: Number(userData.rejectedReports || 0),
      };

      // Always reconcile with real incidents (fixes historical double-counting)
      try {
        stats = await syncUserReportStats(userDoc.id);
      } catch (syncError) {
        console.warn('Could not sync report stats for recommended user:', userDoc.id, syncError);
        try {
          stats = await getUserReportStats(userDoc.id);
        } catch {
          // keep stored counters
        }
      }

      users.push({
        id: userDoc.id,
        ...userData,
        ...stats,
      });
    }
    
    // Sort by score in memory to avoid composite index requirement
    users.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    return users;
  } catch (error) {
    console.error('Error getting recommended users:', error);
    return [];
  }
};
