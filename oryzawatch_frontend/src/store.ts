// Central Application Store
import rootReducer from './reducers';
import type { RootState, Action } from './reducers/types';

export type Listener = () => void;

class Store {
  private state: RootState;
  private listeners: Listener[] = [];

  constructor() {
    this.state = rootReducer(undefined, { type: '@@INIT' });
  }

  getState(): RootState {
    return this.state;
  }

  dispatch(action: Action): Action {
    this.state = rootReducer(this.state, action);
    this.listeners.forEach((listener) => listener());
    return action;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const store = new Store();
export default store;
