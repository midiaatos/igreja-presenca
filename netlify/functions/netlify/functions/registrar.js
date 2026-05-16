const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const { Readable } = require('stream');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { membros, servico, data } = body;
  if (!membros || !membros.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
  }

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });
  let sheet = doc.sheetsByTitle[today];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: today,
      headerValues: ['Nome', 'Categoria', 'Data/Hora', 'Serviço', 'Foto (Link)']
    });
  } else {
    await sheet.loadHeaderRow();
  }

  const drive = google.drive({ version: 'v3', auth: serviceAccountAuth });

  for (const membro of membros) {
    let fotoLink = '';

    if (membro.foto) {
      try {
        const base64Data = membro.foto.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const dataHora = new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Manaus' }).replace(/[/:]/g, '-').replace(/ /g, '_').replace(/,/g, '');
        const fileName = `${membro.nome.replace(/\s+/g, '_')}_${dataHora}.jpg`;

        const { data: fileData } = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            mimeType: 'image/jpeg',
          },
          media: {
            mimeType: 'image/jpeg',
            body: Readable.from(buffer),
          },
          fields: 'id,webViewLink',
        });

        await drive.permissions.create({
          fileId: fileData.id,
          requestBody: { role: 'reader', type: 'anyone' },
        });

        fotoLink = fileData.webViewLink || '';
      } catch (err) {
        console.error('Erro ao salvar foto:', err);
      }
    }

    const dataHoraBR = new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Manaus' });

    await sheet.addRow({
      'Nome': membro.nome,
      'Categoria': membro.tipo,
      'Data/Hora': dataHoraBR,
      'Serviço': servico || 'Culto',
      'Foto (Link)': fotoLink,
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, total: membros.length })
  };
};
