const axios = require('axios');
async function name() {
    const response = await axios.request({
        method: 'POST',
        url: 'https://devapi.endato.com/Contact/Id',
        headers: {
          accept: 'application/json',
          'galaxy-ap-name': '12b8b798-8854-49ac-878c-48ac1d6bdec6',
          'galaxy-ap-password': '53fa790fcb4c412b86278d941f25eec7',
          'galaxy-search-type': 'DevAPIContactID',
          'content-type': 'application/json',
          'galaxy-client-type': 'DevAPIContactEnrich',
        },
        data: {
          "PersonID": `G-447285716938497099`
        }
      })    
      console.log(response.data);
}
name();