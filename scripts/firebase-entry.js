import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, ref, get, set, update, onValue, push, runTransaction, serverTimestamp, onDisconnect, connectDatabaseEmulator } from 'firebase/database';
globalThis.CabelFirebase = { initializeApp, getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, getDatabase, ref, get, set, update, onValue, push, runTransaction, serverTimestamp, onDisconnect, connectAuthEmulator, connectDatabaseEmulator };
