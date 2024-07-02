const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const MELHOR_ENVIO_API_URL = process.env.MELHOR_ENVIO_API_URL;
const MELHOR_ENVIO_API_TOKEN = process.env.MELHOR_ENVIO_API_TOKEN;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL;
const PAGE = process.env.PAGE;
const ISTODAY = process.env.ISTODAY;

if (ISTODAY) {
    function verifyDate(dataString) {
        const dataAtualSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const dataFornecida = new Date(dataString);
        const dataFornecidaSP = new Date(dataFornecida.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        return (
            dataFornecidaSP.getFullYear() === dataAtualSP.getFullYear() &&
            dataFornecidaSP.getMonth() === dataAtualSP.getMonth() &&
            dataFornecidaSP.getDate() === dataAtualSP.getDate()
        );
    }
} else {
    function verifyDate(dataString) {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);

        const dataFornecida = new Date(dataString);

        return (
            dataFornecida.getFullYear() === ontem.getFullYear() &&
            dataFornecida.getMonth() === ontem.getMonth() &&
            dataFornecida.getDate() === ontem.getDate()
        );
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function log(data) {
    return new Promise((resolve, reject) => {
        fs.appendFile('log.txt', data + '\n', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function pipefyRequest(query) {
    let data = JSON.stringify({
        query: query,
        variables: {},
    });

    let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://api.pipefy.com/graphql",
        headers: {
            Authorization: "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJ1c2VyIjp7ImlkIjozMDE5OTU2ODEsImVtYWlsIjoiZmVsaXBlcm9zZW5la0BnbWFpbC5jb20iLCJhcHBsaWNhdGlvbiI6MzAwMTQyMDIwfX0.JugAF92MqbUV_fLVKEcF5jUI3G4G2hlAmLeBJ-dEfsEIlX3gdKO1IfbQRUYvHvAk569vuD9K_zCrKylY6R6agw",
            "Content-Type": "application/json",
            Cookie: "__cfruid=-1699643339",
        },
        data: data,
    };

    const responseData = await axios.request(config);
    return responseData.data;
}

console.log("Melhor Envio API");

async function fetchOrders(nextPage) {
    if (!nextPage) {
        nextPage = `${MELHOR_ENVIO_API_URL}?page=${PAGE}`;
    }
    try {
        const response = await axios.get(nextPage, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${MELHOR_ENVIO_API_TOKEN}`,
                'User-Agent': `Aplicação (${CONTACT_EMAIL})`
            }
        });
        const orders = response.data.data;
        const config = {
            next_page: response.data.next_page_url,
            totalOrders: response.data.total,
        };

        console.log("Página atual: " + response.data.current_page);

        for (let index = 0; index < orders.length; index++) {
            const order = orders[index];
            const orderData = {};
            orderData.posted_at = order.posted_at;
            orderData.paid_at = order.paid_at;
            orderData.tracking = order.self_tracking;
            orderData.name = order.to.name;
            orderData.phone = order.to.phone;
            if (order.tags.length > 0) {
                orderData.cardid = order.tags[0].tag;
            } else {
                orderData.cardid = null;
            }
            orderData.infos = {
                "name": orderData.name,
                "cardid": orderData.cardid
            };

            orderData.service = order.service.company.name;
            var service = order.service.company.name;
            service = service.toLowerCase();

            const phone = order.to.phone;
            const name = orderData.name;

            if (verifyDate(orderData.paid_at)) {
                console.log(" --> Nome: " + orderData.name + " | " + orderData.phone + " | " + orderData.tracking);
                await axios.get("https://api.utalk.chat/send/tc8bgmg/?cmd=chat&to=" + phone + "@c.us&msg=Olá " + name.split(" ")[0] + ", viemos informar que seu pedido já foi enviado.%0A%0ASegue abaixo o link para consultar o andamento da sua entrega. %0A%0Ahttps://app.melhorrastreio.com.br/app/" + service + "/" + orderData.tracking);
                await delay(1000);
                await axios.get("https://api.utalk.chat/send/tc8bgmg/?cmd=chat&to=" + phone + "@c.us&msg=A responsabilidade de acompanhar o rastreio, contactar a transportadora em caso de problema na entrega ou retirar o pedido na agência é do associado. %0A %0A Agradecemos e ficamos a disposição 🙏");
                await log("Nome: " + orderData.name + " | " + orderData.phone + " | " + orderData.tracking);
                await delay(3000);

                await pipefyRequest(
                    'mutation {moveCardToPhase(input: {card_id: ' + orderData.cardid + ', destination_phase_id:311232364}) { clientMutationId} }',
                );
                await delay(1000);

                await pipefyRequest(
                    'mutation {moveCardToPhase(input: {card_id: ' + orderData.cardid + ', destination_phase_id:312818876}) { clientMutationId} }',
                );
                await delay(1000);

                await pipefyRequest(
                    'mutation{ updateCardField(input:{ card_id: ' + orderData.cardid + ', field_id:"ol_segue_o_c_digo_de_rastreamento_do_seu_pedido", new_value:"https://app.melhorrastreio.com.br/app/jadlog/' + orderData.tracking + '" }) { clientMutationId } }',
                );

                await delay(1000);

            } else {
                break;
            }
        }

        if (config.next_page) {
            await fetchOrders(config.next_page);
        } else {
            console.log('Todas as páginas foram processadas.');
        }
    } catch (error) {
        console.error('Erro ao fazer a requisição:', error);
    }
}

async function trackingData(nextPage, trackingCode) {
    let tracking = "";

    if (!nextPage) {
        nextPage = `${MELHOR_ENVIO_API_URL}?page=${PAGE}`;
    }

    try {
        const response = await axios.get(nextPage, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${MELHOR_ENVIO_API_TOKEN}`,
                'User-Agent': `Aplicação (${CONTACT_EMAIL})`
            }
        });
        const orders = response.data.data;
        const config = {
            next_page: response.data.next_page_url,
            totalOrders: response.data.total,
        };

        console.log("Página atual: " + response.data.current_page);

        const searchCod = orders.filter(item => item.self_tracking === trackingCode);
        console.log(searchCod);

        if (searchCod.length > 0) {
            console.log(searchCod[0].tracking);
            tracking = searchCod[0].tracking;
            return searchCod[0];
        }

        if (config.next_page) {
            tracking = await trackingData(config.next_page, trackingCode);
        } else {
            console.log('Todas as páginas foram processadas.');
        }
    } catch (error) {
        console.error('Erro ao fazer a requisição:', error);
    }

    return tracking;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/', async (req, res) => {
    try {
        await fetchOrders();
        res.status(200).send('Orders fetched successfully.');
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).send('Erro ao buscar pedidos.');
    }
});

app.post('/tracking', async (req, res) => {
    try {
        const trackingInfo = await trackingData("", req.body.trackingCode);
        if (trackingInfo) {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Informações do Rastreamento</title>
                    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
                </head>
                <body>
                    <div class="container mt-5">
                        <h1 class="mb-4">Informações do Rastreamento</h1>
                        <a href="https://app.melhorrastreio.com.br/app/melhorenvio/${trackingInfo.self_tracking}" target="_blank">https://app.melhorrastreio.com.br/app/melhorenvio/${trackingInfo.self_tracking}</a>
                        <ul class="list-group">
                        <li class="list-group-item"><strong>Nome do Destinatário:</strong> ${trackingInfo.to.name}</li>
                            <li class="list-group-item"><strong>Endereço do Destinatário:</strong> ${trackingInfo.to.address}, ${trackingInfo.to.location_number}, ${trackingInfo.to.district}, ${trackingInfo.to.city} - ${trackingInfo.to.state_abbr}, ${trackingInfo.to.postal_code}</li>
                            <li class="list-group-item"><strong>Status:</strong> ${trackingInfo.status}</li>
                            <li class="list-group-item"><strong>Rastreamento:</strong> ${trackingInfo.tracking}</li>                            
                            <li class="list-group-item"><strong>Data de Entrega:</strong> ${trackingInfo.delivered_at}</li>
                             <li class="list-group-item"><strong>ID:</strong> ${trackingInfo.id}</li>
                            <li class="list-group-item"><strong>Protocolo:</strong> ${trackingInfo.protocol}</li>
                        </ul>
                        <a href="/rastreamento" class="btn btn-primary mt-4">Voltar</a>
                    </div>
                    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
                    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
                    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
                </body>
                </html>
            `);
        } else {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Código de Rastreamento Não Encontrado</title>
                    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
                </head>
                <body>
                    <div class="container mt-5">
                        <p class="alert alert-danger">Código de rastreamento não encontrado.</p>
                        <a href="/rastreamento" class="btn btn-primary">Voltar</a>
                    </div>
                    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
                    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
                    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).send('Erro ao buscar pedidos.');
    }
});


app.get('/rastreamento', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rastreamento Melhor Envio</title>
            <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body, html {
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                }
                .loader {
                    border: 8px solid #f3f3f3;
                    border-top: 8px solid #3498db;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    animation: spin 2s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container text-center">
                <div id="form-container">
                    <h1 class="mb-4">Rastreamento Melhor Envio</h1>
                    <form id="trackingForm" action="/tracking" method="post">
                        <div class="form-group">
                            <label for="trackingCode">Código de Rastreamento:</label>
                            <input type="text" class="form-control" id="trackingCode" name="trackingCode" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Rastrear</button>
                    </form>
                </div>
                <div id="loader" class="loader mt-4" style="display: none;"></div>
            </div>

            <script>
                document.getElementById('trackingForm').addEventListener('submit', function() {
                    document.getElementById('form-container').style.display = 'none';
                    document.getElementById('loader').style.display = 'block';
                });
            </script>
            <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
            <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
        </body>
        </html>
    `);
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
