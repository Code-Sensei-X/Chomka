import webview

def main():
    window = webview.create_window('Hello', html='<h1>Hello world</h1>')
    webview.start()

if __name__ == '__main__':
    main()
