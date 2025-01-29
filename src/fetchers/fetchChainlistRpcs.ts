import config from "../constants/config";
import parseChainlistRpcs from "../parsers/parseChainlistRpcs";

export default async function fetchExtraRpcs() {
    const response = await fetch(config.CHAINLIST_URL);
    const data = await response.text();
    return parseChainlistRpcs(data);
}
