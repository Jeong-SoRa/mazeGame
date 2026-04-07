import { initializeApp } from 'firebase/app';

// ⚠️ Firebase 콘솔(https://console.firebase.google.com)에서 프로젝트 생성 후
// 아래 값을 실제 값으로 교체하세요.
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export const app = initializeApp(firebaseConfig);
