import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CircleData, FamilyMember, SavedPlace, ChatMessage, SosAlert } from '../types';

/**
 * Service to manage 100% real-time, peer-to-peer family circle sync
 * across physical Android phones and browsers using Cloud Firestore.
 */

export interface CircleSyncCallbacks {
  onCircleUpdate: (data: Partial<CircleData>) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscribe to all real-time updates for a circle:
 * - Circle metadata (name, admin)
 * - Member list & live GPS coordinates
 * - Geofenced Saved Places
 * - Family Chat messages
 * - SOS Alerts
 * - Remote Alarms
 */
export function subscribeToCircleFirestore(
  circleId: string,
  callbacks: CircleSyncCallbacks
): () => void {
  const unsubscribers: Unsubscribe[] = [];
  const cleanCircleId = circleId.trim().toUpperCase();

  try {
    // 1. Listen to Circle Root Document
    const circleRef = doc(db, 'circles', cleanCircleId);
    const unsubCircle = onSnapshot(
      circleRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          callbacks.onCircleUpdate({
            circleId: cleanCircleId,
            name: d.name || 'Family Circle',
            adminMemberId: d.adminMemberId,
            inviteCode: d.inviteCode || cleanCircleId,
            speedLimitAlertThresholdMph: d.speedLimitAlertThresholdMph || 10,
          });
        }
      },
      (err) => {
        console.warn('Firestore circle root snapshot notice:', err);
        callbacks.onError?.(err);
      }
    );
    unsubscribers.push(unsubCircle);

    // 2. Listen to All Circle Members (Live GPS, Battery, Speed)
    const membersRef = collection(db, 'circles', cleanCircleId, 'members');
    const unsubMembers = onSnapshot(
      membersRef,
      (querySnap) => {
        const membersMap: Record<string, FamilyMember> = {};
        querySnap.forEach((docSnap) => {
          const m = docSnap.data() as FamilyMember;
          membersMap[docSnap.id] = {
            ...m,
            id: docSnap.id,
          };
        });
        callbacks.onCircleUpdate({ members: membersMap });
      },
      (err) => console.warn('Firestore members snapshot notice:', err)
    );
    unsubscribers.push(unsubMembers);

    // 3. Listen to Saved Places
    const placesRef = collection(db, 'circles', cleanCircleId, 'places');
    const unsubPlaces = onSnapshot(
      placesRef,
      (querySnap) => {
        const placesList: SavedPlace[] = [];
        querySnap.forEach((docSnap) => {
          placesList.push({
            ...(docSnap.data() as SavedPlace),
            id: docSnap.id,
          });
        });
        callbacks.onCircleUpdate({ places: placesList });
      },
      (err) => console.warn('Firestore places snapshot notice:', err)
    );
    unsubscribers.push(unsubPlaces);

    // 4. Listen to Family Chat Messages (sorted chronologically)
    const chatQuery = query(
      collection(db, 'circles', cleanCircleId, 'chat'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    const unsubChat = onSnapshot(
      chatQuery,
      (querySnap) => {
        const chatList: ChatMessage[] = [];
        querySnap.forEach((docSnap) => {
          chatList.push({
            ...(docSnap.data() as ChatMessage),
            id: docSnap.id,
          });
        });
        callbacks.onCircleUpdate({ chat: chatList });
      },
      (err) => console.warn('Firestore chat snapshot notice:', err)
    );
    unsubscribers.push(unsubChat);

    // 5. Listen to SOS Alerts
    const sosRef = collection(db, 'circles', cleanCircleId, 'sos');
    const unsubSos = onSnapshot(
      sosRef,
      (querySnap) => {
        const sosList: SosAlert[] = [];
        querySnap.forEach((docSnap) => {
          sosList.push({
            ...(docSnap.data() as SosAlert),
            id: docSnap.id,
          });
        });
        callbacks.onCircleUpdate({ sosAlerts: sosList });
      },
      (err) => console.warn('Firestore SOS snapshot notice:', err)
    );
    unsubscribers.push(unsubSos);

    // 6. Listen to Active Remote Alarms
    const alarmsRef = collection(db, 'circles', cleanCircleId, 'alarms');
    const unsubAlarms = onSnapshot(
      alarmsRef,
      (querySnap) => {
        const alarmsMap: Record<string, any> = {};
        querySnap.forEach((docSnap) => {
          alarmsMap[docSnap.id] = docSnap.data();
        });
        callbacks.onCircleUpdate({ activeAlarms: alarmsMap });
      },
      (err) => console.warn('Firestore alarms snapshot notice:', err)
    );
    unsubscribers.push(unsubAlarms);
  } catch (err) {
    console.warn('Failed to initialize Firestore listeners:', err);
  }

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
  };
}

/**
 * Create a new Family Circle directly in Firestore
 */
export async function createCircleInFirestore(
  circleId: string,
  name: string,
  adminMember: FamilyMember
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const circleRef = doc(db, 'circles', cleanCode);
  const memberRef = doc(db, 'circles', cleanCode, 'members', adminMember.id);

  await setDoc(
    circleRef,
    {
      circleId: cleanCode,
      name,
      adminMemberId: adminMember.id,
      inviteCode: cleanCode,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    },
    { merge: true }
  );

  await setDoc(memberRef, adminMember, { merge: true });

  // Add default welcome message
  const chatRef = doc(db, 'circles', cleanCode, 'chat', 'msg-welcome');
  await setDoc(chatRef, {
    id: 'msg-welcome',
    memberId: 'system',
    memberName: 'KinTrack Family Hub',
    memberAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=256&h=256&q=80',
    text: `Welcome to ${name}! All members with code ${cleanCode} sync in real-time.`,
    timestamp: Date.now(),
    type: 'text',
  });
}

/**
 * Join an existing circle by registering the member document
 */
export async function joinCircleInFirestore(
  circleId: string,
  member: FamilyMember
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const circleRef = doc(db, 'circles', cleanCode);
  const memberRef = doc(db, 'circles', cleanCode, 'members', member.id);

  // Ensure circle doc exists
  const snap = await getDoc(circleRef);
  if (!snap.exists()) {
    await setDoc(
      circleRef,
      {
        circleId: cleanCode,
        name: 'Orbit Family Circle',
        adminMemberId: member.id,
        inviteCode: cleanCode,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      },
      { merge: true }
    );
  }

  await setDoc(memberRef, member, { merge: true });
}

/**
 * Update a member's live location, battery, speed, and activity in Firestore
 */
export async function updateMemberLocationInFirestore(
  circleId: string,
  memberId: string,
  data: Partial<FamilyMember>
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const memberRef = doc(db, 'circles', cleanCode, 'members', memberId);
  await setDoc(memberRef, { ...data, lastUpdated: Date.now() }, { merge: true });
}

/**
 * Send a chat message into Firestore
 */
export async function sendChatMessageInFirestore(
  circleId: string,
  message: ChatMessage
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const msgRef = doc(db, 'circles', cleanCode, 'chat', message.id);
  await setDoc(msgRef, message);
}

/**
 * Save or update a Geofenced Saved Place
 */
export async function savePlaceInFirestore(
  circleId: string,
  place: SavedPlace
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const placeRef = doc(db, 'circles', cleanCode, 'places', place.id);
  await setDoc(placeRef, place, { merge: true });
}

/**
 * Delete a Saved Place
 */
export async function deletePlaceInFirestore(
  circleId: string,
  placeId: string
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const placeRef = doc(db, 'circles', cleanCode, 'places', placeId);
  await deleteDoc(placeRef);
}

/**
 * Trigger or resolve an SOS alert
 */
export async function setSosInFirestore(
  circleId: string,
  alert: SosAlert
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const sosRef = doc(db, 'circles', cleanCode, 'sos', alert.id);
  await setDoc(sosRef, alert, { merge: true });
}

/**
 * Trigger or silence a Remote Alarm
 */
export async function setAlarmInFirestore(
  circleId: string,
  targetMemberId: string,
  active: boolean,
  senderName: string
): Promise<void> {
  const cleanCode = circleId.trim().toUpperCase();
  const alarmRef = doc(db, 'circles', cleanCode, 'alarms', targetMemberId);
  if (active) {
    await setDoc(alarmRef, { active: true, senderName, timestamp: Date.now() });
  } else {
    await deleteDoc(alarmRef);
  }
}
