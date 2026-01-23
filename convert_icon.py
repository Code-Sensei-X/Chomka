from PIL import Image
import os

img = Image.open('sakura.png')
img.save('sakura.ico', format='ICO', sizes=[(256, 256)])
print("Converted sakura.png to sakura.ico")
