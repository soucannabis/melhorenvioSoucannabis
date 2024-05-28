const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const MELHOR_ENVIO_API_URL = process.env.MELHOR_ENVIO_API_URL;
const MELHOR_ENVIO_API_TOKEN = process.env.MELHOR_ENVIO_API_TOKEN;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL
const PAGE = process.env.PAGE
const ISTODAY = process.env.ISTODAY


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
            Authorization:
                "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJ1c2VyIjp7ImlkIjozMDE5OTU2ODEsImVtYWlsIjoiZmVsaXBlcm9zZW5la0BnbWFpbC5jb20iLCJhcHBsaWNhdGlvbiI6MzAwMTQyMDIwfX0.JugAF92MqbUV_fLVKEcF5jUI3G4G2hlAmLeBJ-dEfsEIlX3gdKO1IfbQRUYvHvAk569vuD9K_zCrKylY6R6agw",
            "Content-Type": "application/json",
            Cookie: "__cfruid=-1699643339",
        },
        data: data,
    };

    const responseData = await axios.request(config);
    return responseData.data;
}
console.log("Melhor Envio API")
async function fetchOrders(nextPage) {   
   
    if (!nextPage) {
        nextPage = `${MELHOR_ENVIO_API_URL}?status=posted&page=${PAGE}`;
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

        console.log("Página atual: "+ response.data.current_page)

        for (let index = 0; index < orders.length; index++) {
            const order = orders[index];

            const orderData = {};
            orderData.posted_at = order.posted_at;
            orderData.paid_at = order.paid_at;
            orderData.tracking = order.tracking;
            orderData.name = order.to.name;
            orderData.phone = order.to.phone;
            if(order.tags.length > 0){
            orderData.cardid = order.tags[0].tag
            }else{
                orderData.cardid = null
            }
            orderData.infos = {
                "name": orderData.name,
                "cardid":orderData.cardid,
                "pago": orderData.paid_at.split(" ")[0],
                "postado": orderData.posted_at.split(" ")[0]
            }

            const phone = order.to.phone;
            const name = orderData.name
  
            if (verifyDate(orderData.posted_at)) {
                console.log(orderData.infos)
                   /*  await axios.get("https://api.utalk.chat/send/tc8bgmg/?cmd=chat&to="+phone+"@c.us&msg=Olá "+name.split(" ")[0]+", viemos informar que seu pedido já foi enviado.%0A%0ASegue abaixo o link para consultar o andamento da sua entrega. %0A%0Ahttps://app.melhorrastreio.com.br/app/jadlog/"+orderData.tracking)
                      await delay(1000);
                      await axios.get("https://api.utalk.chat/send/tc8bgmg/?cmd=chat&to="+phone+"@c.us&msg=A responsabilidade de acompanhar o rastreio, contactar a transportadora em caso de problema na entrega ou retirar o pedido na agência é do associado. %0A %0A Agradecemos e ficamos a disposição 🙏")
                      console.log("Data postagem: "+orderData.posted_at+" --> Nome: "+orderData.name + " | " + orderData.phone+ " | " +  orderData.tracking)
                      await log("Data postagem: "+orderData.posted_at+" --> Nome: "+orderData.name + " | " + orderData.phone+ " | " +  orderData.tracking);
                      await delay(3000);
     
                     await pipefyRequest(
                         'mutation {moveCardToPhase(input: {card_id: ' + orderData.cardid + ', destination_phase_id:311232364}) { clientMutationId} }',
                     );
                     await delay(1000)
     
                     await pipefyRequest(
                         'mutation {moveCardToPhase(input: {card_id: ' + orderData.cardid + ', destination_phase_id:312818876}) { clientMutationId} }',
                     );
                     await delay(1000)*/

            } else {
                break
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

const app = express();
app.use(express.json());

app.get('/', async (req, res) => {
    try {
        await fetchOrders();
        res.status(200).send('Orders fetched successfully.');
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).send('Erro ao buscar pedidos.');
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});
