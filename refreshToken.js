//install axios
import axios from "axios";



////// send token in all requests
axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.common["Authentication"] = token;
    }
    return config;
});
///////refresh token config
let isRefreshing = false;
let failedQueue = [];
const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};
///// refresh token
axios.interceptors.response.use(
    function (response) {
        return response;
    },
    function (error) {
        const originalRequest = error.config;
        if (error.response.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers["Authentication"] = token;
                        axios.defaults.headers.common["Authentication"] = token;
                        return axios(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }
            originalRequest._retry = true;
            isRefreshing = true;
            const refreshToken = getRefreshToken();
            return new Promise(function (resolve, reject) {
                axios
                    .get(`axios/authentication/refresh/${refreshToken}`)
                    .then(({ data }) => {

                        saveToken(data);
                        axios.defaults.headers.common["Authentication"] = data.token;
                        originalRequest.headers["Authentication"] = data.token;
                        processQueue(null, data.token);
                        resolve(axios(originalRequest));
                    })
                    .catch((err) => {
                        processQueue(err, null);
                        reject(err);
                        /////logout user
                        destroyToken()

                    })
                    .finally(() => {
                        isRefreshing = false;
                    });
            });
        }

        return Promise.reject(error);
    }
);

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refresh_token";
const saveToken = (data) => {

    window.localStorage.setItem(TOKEN_KEY, data.token);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
};

const getToken = () => {
    return window.localStorage.getItem(TOKEN_KEY);
}
const getRefreshToken = () => {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
};

const destroyToken = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
};
