import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACCESS_TOKEN: 'ow_access_token',
  REFRESH_TOKEN: 'ow_refresh_token',
};

export const storage = {
  async saveTokens(access: string, refresh: string): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.ACCESS_TOKEN, access],
      [KEYS.REFRESH_TOKEN, refresh],
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN]);
  },
};
