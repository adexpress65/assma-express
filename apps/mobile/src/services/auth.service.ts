import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'; //  À SUPPRIMER (Auth centralisé) //  À SUPPRIMER (Auth centralisé)

import { auth } from '@/config/firebase';

export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const register = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const observeAuth = (cb: (user: User | null) => void) =>
  onAuthStateChanged(auth, cb);
