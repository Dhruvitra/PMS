import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Organization, OrgRole } from '../../types';

interface OrganizationState {
  organizations: Organization[];
  currentOrg: Organization | null;
  orgRole: OrgRole | null;
  loading: boolean;
}

const loadCurrentOrg = (): Organization | null => {
  const stored = sessionStorage.getItem('currentOrg');
  return stored ? JSON.parse(stored) : null;
};

const loadOrgRole = (): OrgRole | null => {
  return sessionStorage.getItem('orgRole') as OrgRole | null;
};

const initialState: OrganizationState = {
  organizations: [],
  currentOrg: loadCurrentOrg(),
  orgRole: loadOrgRole(),
  loading: false,
};

const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    setOrganizations: (state, action: PayloadAction<Organization[]>) => {
      state.organizations = action.payload;
      state.loading = false;
    },
    setCurrentOrg: (state, action: PayloadAction<{ org: Organization; role: OrgRole }>) => {
      state.currentOrg = action.payload.org;
      state.orgRole = action.payload.role;
      sessionStorage.setItem('currentOrg', JSON.stringify(action.payload.org));
      sessionStorage.setItem('orgRole', action.payload.role);
    },
    clearOrganizations: (state) => {
      state.organizations = [];
      state.currentOrg = null;
      state.orgRole = null;
      state.loading = false;
      sessionStorage.removeItem('currentOrg');
      sessionStorage.removeItem('orgRole');
    },
    updateCurrentOrg: (state, action: PayloadAction<Organization>) => {
      state.currentOrg = action.payload;
      sessionStorage.setItem('currentOrg', JSON.stringify(action.payload));
      
      // Also update in the list
      state.organizations = state.organizations.map(org => 
        org.id === action.payload.id ? { ...org, ...action.payload } : org
      );
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setOrganizations, setCurrentOrg, clearOrganizations, updateCurrentOrg, setLoading } =
  organizationSlice.actions;
export default organizationSlice.reducer;
