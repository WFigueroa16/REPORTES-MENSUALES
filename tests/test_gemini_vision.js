const fs = require('fs');
const path = require('path');

async function testGeminiVision() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('No GEMINI_API_KEY');
    return;
  }

  const imgPath = 'C:/Users/saint/.gemini/antigravity/brain/8d3d1060-b9ec-4ef5-adf8-22a66f4b737c/.user_uploaded/media_1793367840260.jpg';
  const buffer = fs.readFileSync(imgPath);
  const base64 = buffer.toString('base64');

  const prompt = `
Eres un asistente industrial experto en telemetría de molienda minera para Planta Beneficio ZA.
Analiza la fotografía de la pantalla HMI Siemens (SIMATIC) y extrae las variables operativas en JSON estricto con esta estructura:
{
  "codigo_molino": "032-208",
  "nombre_pantalla": "Molino de bolas 032-208",
  "timestamp_pantalla": "YYYY-MM-DD HH:mm:ss",
  "estados_discretos": { "motor_principal": "ON" },
  "sensores": [
    { "acronimo": "VR1", "descripcion": "Sensor vibracion", "valor_actual": 0.9, "unidad": "mm/seg", "alarma": 6.0, "falla": 8.0 }
  ]
}
REGLAS:
1. Extrae el código de molino exacto (ej. 032-208, 032-207, 032-206, etc).
2. Extrae la fecha y hora que aparece en la pantalla HMI (formato YYYY-MM-DD HH:mm:ss).
3. Convierte comas decimales a puntos (ej. 69,3 -> 69.3).
4. Extrae todos los sensores con sus valores actuales.
Responde ÚNICAMENTE en JSON válido.
`;

  console.log('Enviando imagen a Gemini 3.5 Flash Vision...');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json'
      }
    })
  });

  const data = await res.json();
  if (data.error) {
    console.error('Error de Gemini:', data.error);
    return;
  }

  const rawText = data.candidates[0].content.parts[0].text;
  console.log('✅ RESPUESTA EXITOSA DE IA VISIÓN:');
  console.log(rawText);
}

testGeminiVision();
