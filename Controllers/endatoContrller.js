const Airtable = require('airtable');
const axios = require('axios');

require('dotenv').config();
const galaxy_name = process.env.galaxy_name;
const galaxy_password = process.env.galaxy_password;
const YOUR_BASE_ID = process.env.YOUR_BASE_ID;
const tabelIDofficers = process.env.tabelIDofficers;
const tabelIDcompanies = process.env.tabelIDcompanies;
const YOUR_API_KEY = process.env.YOUR_API_KEY;

let BusinessV2SearchIndexCounter = 0;
let ContactEnrichIndex = 0;

function add_finalObj_inAirTable(finalObj) {
    const base = new Airtable({apiKey: YOUR_API_KEY}).base(YOUR_BASE_ID);
    const PrimaryNames = finalObj['Primary Names']
    const CopyPasteURLs = finalObj['CopyPasteURLs']
    // Concatenate the array elements into a single string with a delimiter
    const delimiter = ', ';
    const companyNames = PrimaryNames.join(delimiter);
    const CopyPasteURLsList = CopyPasteURLs.join(delimiter)
    base(tabelIDcompanies)
        .create([
            {
                fields: {
                    'result': finalObj['result'],
                    'Bureau Number': finalObj['Bureau Number'],
                    // 'Primary Name': finalObj['Primary Name'],
                    'Company Names': companyNames,
                    'Street Address': finalObj['Street Address'],
                    'City': finalObj['City'],
                    'State': finalObj['State'],
                    'Zip Code': finalObj['Zip Code'],
                    'County': finalObj['County'],
                    'Governing Class': finalObj['Governing Class'],
                    "Description": finalObj['Description'],
                    "Ex Mod Year": finalObj['Ex Mod Year'],
                    "ExMod": finalObj['ExMod'],
                    "Updated On": finalObj['Updated On'],
                    "ExMod Change": finalObj['ExMod Change'],
                    "Insurer Name": finalObj['Insurer Name'],
                    "Insurer Group": finalObj['Insurer Group'],
                    "Advisory Rate": finalObj['Advisory Rate'],
                    "Rate Eff Date": finalObj['Rate Eff Date'],
                    "SubClass1": finalObj['SubClass1'],
                    "Desc1": finalObj['Desc1'],
                    "SubClass2": finalObj['SubClass2'],
                    "Desc2": finalObj['Desc2'],
                    "PriorExModYear1": finalObj['PriorExModYear1'],
                    "PriorExMod1": finalObj['PriorExMod1'],
                    "PriorExModYear2": finalObj['PriorExModYear2'],
                    "PriorExMod2": finalObj['PriorExMod2'],
                    "PriorExModYear3": finalObj['PriorExModYear3'],
                    "PriorExMod3": finalObj['PriorExMod3'],
                    "PriorExModYear4": finalObj['PriorExModYear4'],
                    "PriorExMod4": finalObj['PriorExMod4'],
                    "GoogleSearch": finalObj['GoogleSearch'],
                    // "CopyPasteURL": finalObj['CopyPasteURL'],
                    "CopyPasteURLs": CopyPasteURLsList
                }
            }
        ],)
        .then((records) => {
            if (finalObj.officers.length > 0) {
                const officers = finalObj
                    .officers
                    .map((officer) => ({
                        fields: {
                            'Person ID': officer['PersonID'],
                            'First Name': officer['FirstName'],
                            'Last Name': officer['LastName'],
                            //'address': officer['Addresses'].addressLine2,
                            'Full Name': officer['fullName'],
                            // 'Street': officer['Street'], 'City': officer['City'], 'State':
                            // officer['State'], 'postal/zip code': officer['postalCode'],
                            'Street': officer['contactDetails']
                                ?.addresses
                                    ?.street,
                            'City': officer['contactDetails']
                                ?.addresses
                                    ?.city,
                            'State': officer['contactDetails']
                                ?.addresses
                                    ?.state,
                            'postal/zip code': officer['contactDetails']
                                ?.addresses
                                    ?.zip,
                            'phone 1': officer['contactDetails']
                                ?.phones[0],
                            'phone 2': officer['contactDetails']
                                ?.phones[1],
                            'phone 3': officer['contactDetails']
                                ?.phones[2],
                            'phone 4': officer['contactDetails']
                                ?.phones[3],
                            'phone 5': officer['contactDetails']
                                ?.phones[4],
                            'phone 6': officer['contactDetails']
                                ?.phones[5],
                            'email 1': officer['contactDetails']
                                ?.emails[0],
                            'email 2': officer['contactDetails']
                                ?.emails[1],
                            'email 3': officer['contactDetails']
                                ?.emails[2],
                            'email 4': officer['contactDetails']
                                ?.emails[3],
                            'email 5': officer['contactDetails']
                                ?.emails[4],
                            'email 6': officer['contactDetails']
                                ?.emails[5],
                            'company': [
                                records[0]
                                    ?.id
                            ], // Link officers to the company record
                        }
                    }));

                base(tabelIDofficers).create(officers, (officerErr) => {
                    if (officerErr) {
                        console.error("from adding data to airtable📢", officerErr);
                        //  return;
                    }
                    console.log('Company and Officer data added successfully.');
                    console.log(
                        "BusinessV2SearchIndexCounter: " + BusinessV2SearchIndexCounter
                    );
                    BusinessV2SearchIndexCounter = 0;
                    console.log("ContactEnrichIndex: " + ContactEnrichIndex);
                    ContactEnrichIndex = 0;
                });
            }
            console.log('Company  data only added 📢📢.');
        })
        .catch((err) => {
            console.error(err);
        });
};

function collect_officers_from_eachbusinessSearch(businessV2res) {
    //! here i collect only officers from each business searh
    let businessV2RecordsList = businessV2res.businessV2Records;
    let idsList_per_officer = [];
    if (businessV2RecordsList.length === 0) {
        console.log("empty response for business search")
        return []
    }
    for (let i = 0; i < businessV2RecordsList.length; i++) {
        let targetResObject = businessV2RecordsList[i];
        let target_usCorpFilings_list = targetResObject.usCorpFilings
        for (let j = 0; j < target_usCorpFilings_list.length; j++) {
            if (target_usCorpFilings_list.length >= 1) {
                let temp_officers_list_per_usCorpFilings = target_usCorpFilings_list[j].officers
                if (temp_officers_list_per_usCorpFilings.length === 0) {
                    console.log("there is no officers in this res")
                    return
                }
                for (let x = 0; x < temp_officers_list_per_usCorpFilings.length; x++) {
                    if (temp_officers_list_per_usCorpFilings.length >= 1) {
                        let target_officer_object = temp_officers_list_per_usCorpFilings[x];
                        //! for getting IDs
                        if (
                            target_officer_object
                                ?.name
                        ) {
                            let tempObj = {
                                "PersonID": target_officer_object
                                    ?.name
                                        ?.tahoeId,
                                "FirstName": target_officer_object
                                    ?.name
                                        ?.nameFirst,
                                "LastName": target_officer_object
                                    ?.name
                                        ?.nameLast,
                                "Street": target_officer_object
                                    ?.address
                                        ?.addressLine1,
                                "City": target_officer_object
                                    ?.address
                                        ?.city,
                                "State": target_officer_object
                                    ?.address
                                        ?.state,
                                "postalCode": target_officer_object
                                    ?.address
                                        ?.zip,
                                "fullName": target_officer_object
                                    ?.name
                                        ?.nameRaw,
                                "Addresses": {
                                    "addressLine2": `${target_officer_object
                                        ?.address
                                            ?.city}, ${target_officer_object
                                                ?.address
                                                    ?.state}`
                                },
                                "addressHash": target_officer_object
                                    ?.address
                                        ?.addressHash,
                                "startDate": target_officer_object
                                    ?.startDate

                            }
                            idsList_per_officer.push(tempObj)
                        }
                    }
                }
            }
        }
    }
    return idsList_per_officer;
};

function collect_officers_from_NewResponse(newres) {
    let businessV2RecordsList = newres.businessV2Records;
    let officersList = []
    for (let i = 0; i < businessV2RecordsList.length; i++) {
        let newBusinessFilings = businessV2RecordsList[i].newBusinessFilings;
        for (let j = 0; j < newBusinessFilings.length; j++) {
            let contacts = newBusinessFilings[j].contacts
            let addresses = newBusinessFilings[j].addresses
            let tempOfficerObj = {};
            contacts
                .filter((item) => item.contactTypeDesc.includes('OFFICER'))
                .forEach((item) => {
                    tempOfficerObj['PersonID'] = item.tahoeId;
                    tempOfficerObj['FirstName'] = item.name.firstName;
                    tempOfficerObj['LastName'] = item.name.lastName;
                    tempOfficerObj['fullName'] = item.name.fullName;
                    tempOfficerObj['contactTypeDesc'] = item.contactTypeDesc
                });
            addresses
                .filter(
                    (item) => item.addressTypeDesc.includes(tempOfficerObj['contactTypeDesc'])
                )
                .forEach((item) => {
                    tempOfficerObj['City'] = item.city;
                    tempOfficerObj['State'] = item.state;
                    tempOfficerObj['postalCode'] = item.zip;
                    tempOfficerObj['Street'] = item.addressLine1;
                    tempOfficerObj['addressTypeDesc'] = item.addressTypeDesc;
                    tempOfficerObj['Addresses'] = {
                        "addressLine2": `${item.city}, ${item.state}`
                    }
                });
            if (tempOfficerObj != {}) {
                officersList.push(tempOfficerObj)
            }
        }
    }
    return officersList;
};

exports.searchForConacts = async function (officersListArr) {
    let officersList = officersListArr
    console.log("my obj befor contact search", officersList)
    for (let i = 0; i < officersList.length; i++) {
        setTimeout(async () => {
            let targetOfficer = officersList[i];
            if (officersList[i]["PersonID"] !== null) {
                try {
                    const response = await axios.request({
                        method: 'POST',
                        url: 'https://devapi.endato.com/Contact/Id',
                        headers: {
                            accept: 'application/json',
                            'galaxy-ap-name': galaxy_name,
                            'galaxy-ap-password': galaxy_password,
                            'galaxy-search-type': 'DevAPIContactID',
                            'content-type': 'application/json',
                            'galaxy-client-type': 'DevAPIContactEnrich'
                        },
                        data: {
                            "PersonID": `${targetOfficer.PersonID}`
                        }
                    })
                    officersList[i].contactDetails = filterController.filterEmails_Phones(
                        response.data
                    );
                } catch (error) {
                    console.error("Error From SearchContact=> id search :", error.message);
                    //*contact enrich
                };
            } else {
                try {
                    const response = await axios.request({
                        method: 'POST',
                        url: 'https://devapi.endato.com/Contact/Enrich',
                        headers: {
                            accept: 'application/json',
                            'galaxy-ap-name': galaxy_name,
                            'galaxy-ap-password': galaxy_password,
                            'galaxy-search-type': 'DevAPIContactEnrich',
                            'content-type': 'application/json',
                            'galaxy-client-type': 'DevAPIContactEnrich'
                        },
                        data: {
                            "FirstName": `${targetOfficer['FirstName']}`,
                            "LastName": `${targetOfficer['LastName']}`,
                            "Address": {

                                "addressLine2": `${targetOfficer.Addresses['addressLine2']}`
                            }
                        }
                    })
                    officersList[i].contactDetails = filterController.filterEmails_Phones(
                        response.data
                    )
                } catch (error) {
                    console.error("Error From SearchContact => enrich search :", error.message);
                };
            }
        }, i * 1000)
        ContactEnrichIndex += 1
    }
    return officersList;
};

exports.step2final_SearchContact = async function (BusinessNames, res) {
    for (let i = 0; i < BusinessNames.length; i++) {
        setTimeout(async () => {
            let tempObj = BusinessNames[i]
            tempObj.officers = []
            for (let x = 0; x < BusinessNames[i]["Primary Names"].length; x++) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                try {
                    console.log(`😒😒😒bus started search ${x}`)
                    const response = await axios.request({
                        method: 'POST',
                        url: 'https://devapi.endato.com/BusinessV2Search',
                        headers: {
                            accept: 'application/json',
                            'galaxy-ap-name': galaxy_name,
                            'galaxy-ap-password': galaxy_password,
                            'galaxy-search-type': 'BusinessV2',
                            'content-type': 'application/json',
                            'galaxy-client-type': 'DevAPIContactEnrich'
                        },
                        data: {
                            "businessName": `${BusinessNames[i]["Primary Names"][x]}`,
                            "addressLine2": `${BusinessNames[i]
                                .City}, ${BusinessNames[i]
                                .State}`
                        }
                    })
                    console.log("😒😒😒bus end search")
                    BusinessV2SearchIndexCounter += 1;
                    if (response.data["businessV2Records"].length === 0) {
                        tempObj.result = `no business result for ${BusinessNames[i]["Primary Names"][x]} `;
                        console.log("🤦‍♂️🤦‍♂️", " empty [] in business search", tempObj);
                    } else {
                        let searchBusinssRes;
                        if (
                            response.data["businessV2Records"][0]['newBusinessFilings']
                                ?.length === 0
                        ) {
                            console.log("📢📢📢usCorpFilings start ....")
                            searchBusinssRes = collect_officers_from_eachbusinessSearch(response.data);
                        }
                        if (
                            response.data["businessV2Records"][0]['usCorpFilings']
                                ?.length === 0
                        ) {
                            console.log("📢📢📢newBusinessFilings start ....")
                            searchBusinssRes = collect_officers_from_NewResponse(response.data)
                        }
                        tempObj
                            .officers
                            .push(searchBusinssRes)
                        console.log("📢📢📢📢📢📢📢📢📢 one after adding officers", tempObj)
                    }
                } catch (error) {
                    console.error("Error From Search business function :", error.message);
                };
            }
            if (tempObj.officers.length > 0) {
                let OfficersDataList = [].concat(...tempObj.officers)
                OfficersDataList = filterController
                    .filterOfficersData(OfficersDataList)
                    .slice(0, 5)
                tempObj.officers = OfficersDataList;
                endatoController
                    .searchForConacts(tempObj.officers)
                    .then((res) => {
                        tempObj.officers = res
                        console.log("FinalObj📢", tempObj)
                        add_finalObj_inAirTable(tempObj)
                    })
                    .catch(err => {
                        console.log("err for new function of getting contacts", err.message)
                    })
                } else {
                tempObj.result = "There is no officers results ";
                console.log("😒😒 officers are empty array ... ")
                tempObj.officers = [];
                endatoController
                    .searchForConacts(tempObj.officers)
                    .then((res) => {
                        tempObj.officers = res
                        console.log("FinalObj📢", tempObj)
                        add_finalObj_inAirTable(tempObj)
                    })
                    .catch(err => {
                        console.log("err for new function of getting contacts", err.message)
                    })
                }
        }, i * 1000)
    }
    res
        .status(200)
        .json({message: 'Data processed successfully'});
};