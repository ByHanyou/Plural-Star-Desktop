/// <reference types="vite/client" />

declare module '*.css';
declare module '*.scss';
declare module '*.module.css' {
  const classes: {readonly [key: string]: string};
  export default classes;
}
