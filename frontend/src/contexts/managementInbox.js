import { createContext, useContext } from 'react';

export const ManagementInboxContext = createContext({});
export const useManagementInbox = () => useContext(ManagementInboxContext);
