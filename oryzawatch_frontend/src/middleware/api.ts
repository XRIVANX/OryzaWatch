import axios from 'axios';
import API from '../utils/api';

export const apiMiddleware = () => (next: (action: any) => any) => (action: any) => {
  if (action && action.meta && action.meta.api) {
    const { url, method = 'GET', data, onSuccess, onError } = action.meta.api;
    return API({
      url,
      method,
      data,
    })
      .then((res) => {
        if (onSuccess) next(onSuccess(res.data));
        return res;
      })
      .catch((err) => {
        if (onError) next(onError(err));
        throw err;
      });
  }
  return next(action);
};

export default apiMiddleware;
