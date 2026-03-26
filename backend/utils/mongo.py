from bson import ObjectId


def clean_mongo(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: clean_mongo(v) for k, v in value.items() if k != "_id"}
    if isinstance(value, list):
        return [clean_mongo(item) for item in value]
    return value
