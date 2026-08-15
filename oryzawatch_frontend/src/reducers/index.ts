import { authReducer } from './auth';
import { postReducer } from './post';
import type { RootState, Action } from './types';

export const rootReducer = (state: Partial<RootState> = {}, action: Action): RootState => {
  return {
    auth: authReducer(state.auth, action),
    post: postReducer(state.post, action),
  };
};

export * from './types';
export default rootReducer;
