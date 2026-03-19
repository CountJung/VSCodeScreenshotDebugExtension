declare module 'screenshot-desktop' {
    interface ScreenshotOptions {
        filename?: string;
        screen?: number;
        format?: 'png' | 'jpg';
    }

    interface Display {
        id: number;
        name?: string;
    }

    function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    namespace screenshot {
        function listDisplays(): Promise<Display[]>;
    }

    export = screenshot;
}
