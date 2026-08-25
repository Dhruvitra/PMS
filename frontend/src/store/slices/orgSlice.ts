import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Organization, OrgRole } from '../../types';

interface OrgState {
  currentOrg: Organization | null;
  orgRole: OrgRole | null;
  loading: boolean;
}

const initialState: OrgState = {
  currentOrg: JSON.parse(sessionStorage.getItem('currentOrg') || 'null'),
  orgRole: (sessionStorage.getItem('orgRole') as OrgRole) || null,
  loading: false,
};

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    setOrg: (state, action: PayloadAction<{ org: Organization; role: OrgRole }>) => {
      state.currentOrg = action.payload.org;
      state.orgRole = action.payload.role;
      state.loading = false;
      sessionStorage.setItem('currentOrg', JSON.stringify(action.payload.org));
      sessionStorage.setItem('orgRole', action.payload.role);
    },
    clearOrg: (state) => {
      state.currentOrg = null;
      state.orgRole = null;
      state.loading = false;
      sessionStorage.removeItem('currentOrg');
      sessionStorage.removeItem('orgRole');
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setOrg, clearOrg, setLoading } = orgSlice.actions;
export default orgSlice.reducer;
