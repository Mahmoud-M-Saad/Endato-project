const express = require('express');
const app = express();
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const util = require('util');

const filterController = require('./Controllers/filterController');
const endatoController = require('./Controllers/endatoContrller');

app.use(express.json());
app.use(cors());

const uploadFile = multer({
    storage: multer.diskStorage({
        destination: "./",
        filename: (req, file, cb) => {
            cb(null, `${file.originalname}`)
        }
    })
});

function saveDataInFS(filePath, dataAsString) {
    fs.writeFile(filePath, dataAsString, (err) => {
        if (err) {
            console.error('Error writing JSON file:', err);
        } else {
            console.log('JSON file saved successfully as JSON.');
        }
    });
};

async function readDataFromFS_ToAirTable(filePath, res) {
    try {
        const data = await util.promisify(fs.readFile)(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        console.log("📢📢📢📢", "data read ...");
        // Perform the complex logic and searches using async/await
        await endatoController.step2final_SearchContact(jsonData, res);
        // After all operations are complete, send the response
    } catch (error) {
        console.error('Error:', error);
        res
            .status(500)
            .json({message: 'Error processing data'});
    }
};

app.post('/gettingData', uploadFile.single('jsonFile'), (req, res) => {
    const filename = req.file.path;
    console.log("req.file...");
    console.log(req.file);
    console.log("fileUploaded :📢📢📢 ", filename)
    fs.readFile(filename, 'utf8', (err, fileData) => {
        if (err) {
            console.error(`Error reading file: ${err}`);
            res
                .status(500)
                .json('Error with reading file');
            return;
        }
        try {
            const jsonData = JSON.parse(fileData);
            const sortedArr = jsonData.sort(
                (a, b) => a["Bureau Number"] - b["Bureau Number"]
            );
            const dataWithUniqueNames = sortedArr.map(element => ({
                ...element,
                "Primary Name": filterController.uniqueNames(element["Primary Name"])
            }));
            const finalFilteredCompanyData = filterController.removeDuplicatesAndFilter_ByState(
                dataWithUniqueNames
            )
            const finalFilteredCompanyDataString = JSON.stringify(finalFilteredCompanyData);
            const finalFilteredCompanyData_filePath = '_TestnewCollectedCompaniesData.json';
            console.log("filtred data start to save ....")
            saveDataInFS(finalFilteredCompanyData_filePath, finalFilteredCompanyDataString);
            console.log("filtred data ready for reading ....")
            readDataFromFS_ToAirTable(finalFilteredCompanyData_filePath, res);
        } catch (err) {
            console.error(`Error parsing JSON: ${err}`);
            res
                .status(500)
                .json('Error >> parsing >> file');
        }
    });
});

app.listen(3000, () => {
    console.log("Welcome Form Server!");
});