const axios = require('axios');

require('dotenv').config();
const ValidatorApiKey = process.env.PHONE_VALIDATOR_API_KEY;

exports.uniqueNames = function (inputText) {
    return inputText
        .replace(/[.,:;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
};

exports.removeDuplicatesAndFilter_ByState = function (dataWithUniqueNames) {
    const finalFilteredCompanyData = [];
    const uniqueCompanyNames = new Set();
    for (const obj of dataWithUniqueNames) {
        //!uniqueCompanyNames.has(obj["Primary Name"]) && obj["State"] === "CA"
        if (true) {
            uniqueCompanyNames.add(obj["Primary Name"]);
            finalFilteredCompanyData.push(obj);
        }
    }
    // Create an object to group objects by Bureau Number
    const groupedData = finalFilteredCompanyData.reduce((result, item) => {
        const key = item['Bureau Number'];
        if (!result[key]) {
            result[key] = {
                'Bureau Number': key,
                'Primary Names': [],
                'CopyPasteURLs': [],
                ...item
            };
        }
        result[key]['Primary Names'].push(item['Primary Name']);
        result[key]['CopyPasteURLs'].push(item['CopyPasteURL']);
        return result;
    }, {});
    // Convert the grouped object back to an array of objects
    const resultArray = Object.values(groupedData);
    return resultArray;
};

exports.filterOfficersData = function (data) {
    // Step 1: Remove empty objects
    const filteredData = data.filter(item => Object.keys(item).length > 0);
    const sortedResult = filteredData.sort((a, b) => {
        if (a.PersonID === null && b.PersonID !== null) {
            return 1;
        }
        if (a.PersonID !== null && b.PersonID === null) {
            return -1;
        }
        return 0;
    });
    const filteredResult = [];
    const uniqueFirstNames = {};
    for (const item of sortedResult) {
        let firstName = item.FirstName;
        let lastName = item.LastName;
        let nameKey = `${firstName} ${lastName}`
        if (!uniqueFirstNames[nameKey]) {
            uniqueFirstNames[nameKey] = true;
            filteredResult.push(item);
        }
    }
    return filteredResult;
};

async function convertAndCheckPhoneNumber(phone) {
    //? To convet the phone number from ((305) 476-9429) to (13054769429)
    const formattedNumber = `1${phone.replace(/\D/g, '')}`;

    //? then check if the number vaild or not
    try {
        const response = await axios.get(
            `https://www.ipqualityscore.com/api/json/phone/${ValidatorApiKey}/${formattedNumber}`
        );
        if (response.data.success && response.data.message === "Phone is valid.") {
            console.log("From Validation Phone Function: Phone is valid");
            return phone
        } else {
            console.log("From Validation Phone Function: Sorry! Phone is not valid");
        }
    } catch (error) {
        console.error('Error making API request:', error.message);
    }
};

exports.filterEmails_Phones = async function (data) {
    if (!data.person) {
        return {
            emails: [],
            phones: [],
            'addresses': {
                "street": "",
                "city": "",
                "state": "",
                "zip": ""
            }
        };
    }
    let NewData = {
        'phones': [],
        'emails': [],
        'addresses': {
            "street": "",
            "city": "",
            "state": "",
            "zip": ""
        }
    }
    for (let i = 0; i < data.person.emails.length; i++) {
        if (!(data.person.emails[i].isValidated)) {
            data
                .person
                .emails
                .splice(i, 1);
            i--;
        } else {
            NewData
                .emails
                .push(data.person.emails[i].email);
        }
    };
    for (let i = 0; i < data.person.phones.length; i++) {
        if (!(data.person.phones[i].isConnected)) {
            data
                .person
                .phones
                .splice(i, 1);
            i--;
        } else {
            data
                .person
                .phones[i]
                .lastReportedDate = new Date(data.person.phones[i].lastReportedDate);
        }
    };
    data
        .person
        .phones
        .sort((a, b) => b.lastReportedDate - a.lastReportedDate);
    data.person.phones = data
        .person
        .phones
        .slice(0, 6);
    for (let i = 0; i < data.person.phones.length; i++) {
        let validPhone = await convertAndCheckPhoneNumber(data.person.phones[i].number)
        NewData
            .phones
            .push(validPhone);
    }
    //==================Addresse=========================
    for (let i = 0; i < data.person.addresses.length; i++) {
        data
            .person
            .addresses[i]
            .lastReportedDate = new Date(data.person.addresses[i].lastReportedDate);
    };
    data
        .person
        .addresses
        .sort((a, b) => b.lastReportedDate - a.lastReportedDate);
    data.person.addresses = data
        .person
        .addresses
        .slice(0, 1);
    for (let i = 0; i < data.person.addresses.length; i++) {
        NewData.addresses.street = data
            .person
            .addresses[i]
            .street;
        NewData.addresses.city = data
            .person
            .addresses[i]
            .city;
        NewData.addresses.state = data
            .person
            .addresses[i]
            .state;
        NewData.addresses.zip = data
            .person
            .addresses[i]
            .zip;
    }
    console.log(NewData);
    return NewData;
};