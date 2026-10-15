# Base synthetic fixture generator; exact noise/stress inputs are versioned beside manifest.json.
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import ctypes as c,wave,json,subprocess
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/ppp-media-fixtures');root.mkdir(exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30)
cards=[
 ('single','Combo De Pollo Broaster\nCódigo #98\nPapa francesa, yuca, arepa y bebida 1.5L\n$55.000\nAñadir', 'order',['98']),
 ('cart','Tu pedido — productos seleccionados\n\n2 x 1 Pollo Frito — código #1\nArepas fritas\n\n1 x Churrasco — código #17\nTérmino 3/4\n\n2 x Sopa De Ajiaco — código #38\nSin arroz\n\nTotal $141.000', 'order',['pollo','churrasco','ajiaco','2']),
 ('japan','Tu pedido — seleccionado\n\n2 x Ramen De Miso — código #801\nSin cebolla\n\n1 x Maki Vegetal — código #802\n\n3 x Té De Jazmín — código #803\nSin azúcar', 'order',['ramen','maki','jazm','2','3']),
 ('menu','MENÚ — elige lo que te guste\n\nRamen De Miso #801 — $24.000\nMaki Vegetal #802 — $18.000\nTé De Jazmín #803 — $5.000', 'unclear',[]),
 ('receipt','COMPROBANTE DE TRANSFERENCIA\n\nNequi\nEstado: enviada\nValor: $50.000\nReferencia de prueba: SIMULADA\nNo es un pedido de comida', 'payment_proof',[])
]
for name,text,kind,terms in cards:
 im=Image.new('RGB',(1100,850),'white');ImageDraw.Draw(im).multiline_text((45,45),text,font=font,fill='#202020',spacing=18);im.save(root/(name+'.png'))
audios=[
 ('wings','Me hace el favor, me envía un combo de alitas con gaseosa Pepsi para el conjunto residencial Pío doce. Muchas gracias.',['combo','alitas','pepsi','pío']),
 ('swap','Me hace el favor, me envía un combo frito, a cambio de la gaseosa un madurito con bocadillo y queso. Muchas gracias.',['combo','frito','cambio','gaseosa','bocadillo','queso']),
 ('japan','Dos ramen de miso, uno sin cebolla y otro normal, y tres tés sin azúcar. Para la calle nueve número veinte treinta.',['dos','miso','sin cebolla','normal','tres','azúcar'])
]
lib=c.CDLL('libespeak-ng.so.1');lib.espeak_Initialize.argtypes=[c.c_int,c.c_int,c.c_char_p,c.c_int];rate=lib.espeak_Initialize(2,0,None,0);lib.espeak_SetVoiceByName(b'es');lib.espeak_SetParameter(1,155,0)
chunks=[]
@c.CFUNCTYPE(c.c_int,c.POINTER(c.c_short),c.c_int,c.c_void_p)
def callback(samples,n,events):
 if samples and n:chunks.append(c.string_at(samples,n*2))
 return 0
lib.espeak_SetSynthCallback(callback)
for name,text,terms in audios:
 chunks.clear();data=text.encode();lib.espeak_Synth(c.c_char_p(data),len(data)+1,0,1,0,1,None,None);lib.espeak_Synchronize()
 with wave.open(str(root/(name+'.wav')),'wb') as out:out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate);out.writeframes(b''.join(chunks))
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(root/(name+'.wav')),'-c:a','libopus',str(root/(name+'.ogg'))],check=True)
(root/'manifest.json').write_text(json.dumps({'images':[{'id':n,'kind':k,'terms':t,'file':str(root/(n+'.png'))} for n,_,k,t in cards],'audios':[{'id':n,'text':x,'terms':t,'file':str(root/(n+'.ogg'))} for n,x,t in audios]},ensure_ascii=False,indent=2))
print('Generated',len(cards),'images and',len(audios),'synthetic Spanish recordings')
