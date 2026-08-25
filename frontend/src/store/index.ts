import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import organizationReducer from './slices/organizationSlice';
import notificationReducer from './slices/notificationSlice';
import themeReducer from './slices/themeSlice';
import messageReducer from './slices/messageSlice';
import { baseApi } from './api/baseApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    organization: organizationReducer,
    notification: notificationReducer,
    theme: themeReducer,
    message: messageReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
