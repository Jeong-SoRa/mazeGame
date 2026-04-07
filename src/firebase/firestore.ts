import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from './config';
import type { RankingEntry } from '../types/game.types';

export const db = getFirestore(app);

// 스테이지 클리어 기록 저장 (최고 기록만 갱신)
export async function saveRanking(
  uid: string,
  displayName: string,
  photoURL: string,
  stage: number,
  steps: number,
  time: number
): Promise<void> {
  const rankRef = doc(db, 'rankings', `stage${stage}`, 'scores', uid);
  const existing = await getDoc(rankRef);

  if (existing.exists()) {
    const data = existing.data();
    // 기존보다 더 좋은 기록(더 적은 스텝)일 때만 갱신
    if (steps >= data.steps) return;
  }

  await setDoc(rankRef, {
    uid,
    displayName,
    photoURL,
    steps,
    time,
    timestamp: serverTimestamp(),
  });
}

// 스테이지 랭킹 조회 (상위 10명)
export async function fetchRankings(stage: number): Promise<RankingEntry[]> {
  const scoresRef = collection(db, 'rankings', `stage${stage}`, 'scores');
  const q = query(scoresRef, orderBy('steps', 'asc'), limit(10));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      uid: data.uid,
      displayName: data.displayName,
      photoURL: data.photoURL,
      steps: data.steps,
      time: data.time,
      timestamp: data.timestamp?.toMillis() ?? 0,
    };
  });
}

// 내 최고 기록 조회
export async function fetchMyBest(uid: string, stage: number): Promise<RankingEntry | null> {
  const rankRef = doc(db, 'rankings', `stage${stage}`, 'scores', uid);
  const snap = await getDoc(rankRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: data.uid,
    displayName: data.displayName,
    photoURL: data.photoURL,
    steps: data.steps,
    time: data.time,
    timestamp: data.timestamp?.toMillis() ?? 0,
  };
}
