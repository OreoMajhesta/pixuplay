/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string;
          callback?: (response: { credential: string; select_by?: string }) => void;
          auto_select?: boolean;
          cancel_on_tap_outside?: boolean;
          context?: string;
        }) => void;
        renderButton: (
          parent: HTMLElement,
          options: {
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            logo_alignment?: 'left' | 'center';
            width?: number | string;
            locale?: string;
          }
        ) => void;
        prompt: (momentListener?: (notification: any) => void) => void;
        cancel: () => void;
        disableAutoSelect: () => void;
      };
    };
  };
}
