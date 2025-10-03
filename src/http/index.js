import axios from "axios";
import { JWT_TOKEN } from "../utils/consts";

const $host = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api/",
});

const $authHost = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api/",
});


const authInterceptor = (config) => {
  config.headers.authorization = `Bearer ${localStorage.getItem(JWT_TOKEN)}`;
  return config;
};

$authHost.interceptors.request.use(authInterceptor);

export { $host, $authHost };
