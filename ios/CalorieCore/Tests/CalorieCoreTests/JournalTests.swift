import XCTest
@testable import CalorieCore
final class JournalTests: XCTestCase {
    let dosa = FoodReference(id: "ASC146", name: "Masala dosa", kcalPer100g: 164.5846710205078, kcalPerServing: 345.0764465332031, servingUnit: "dosa", servingUsable: true, source: "asc_manual", sourceRow: 133)
    func testCountAndWeightAreDifferent() throws {
        XCTAssertEqual(try dosa.calories(quantity: 2, basis: .servings), 690.1528930664062, accuracy: 0.000001)
        XCTAssertEqual(try dosa.calories(quantity: 200, basis: .grams), 329.1693420410156, accuracy: 0.000001)
        XCTAssertEqual(try dosa.calories(quantity: 0.5, basis: .servings), 172.53822326660156, accuracy: 0.000001)
    }
    func testInvalidQuantities() {
        for value in [0.0, -1, .nan, .infinity] { XCTAssertThrowsError(try dosa.calories(quantity: value, basis: .servings)) }
    }
    func testMissingServingRequiresWeight() throws {
        let food = FoodReference(id: "missing", name: "food", kcalPer100g: 100, kcalPerServing: nil, servingUnit: nil, servingUsable: false, source: "source", sourceRow: 2)
        XCTAssertThrowsError(try food.calories(quantity: 1, basis: .servings))
        XCTAssertEqual(try food.calories(quantity: 50, basis: .grams), 50)
    }
    func testRoundTripAndEdit() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = JournalFile(url: directory.appendingPathComponent("meals.json"))
        var snapshot = try file.load()
        snapshot.meals = [try JournalMeal(food: dosa, quantity: 2, basis: .servings)]
        snapshot.dailyTarget = 2100
        try file.save(snapshot)
        var loaded = try file.load()
        XCTAssertEqual(loaded.meals[0].food.id, "ASC146")
        XCTAssertEqual(loaded.dailyTarget, 2100)
        loaded.meals[0].quantity = 0.5
        try file.save(loaded)
        XCTAssertEqual(try file.load().meals[0].calories, 172.53822326660156, accuracy: 0.000001)
    }
    func testCorruptFileIsNotReset() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent("meals.json")
        try Data("corrupt".utf8).write(to: url)
        XCTAssertThrowsError(try JournalFile(url: url).load())
        XCTAssertEqual(try String(contentsOf: url), "corrupt")
    }
    func testDailyTotalUsesLocalDay() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 19800)!
        let today = Date(timeIntervalSince1970: 1788739200)
        var state = JournalSnapshot()
        state.meals = [try JournalMeal(date: today, food: dosa, quantity: 1, basis: .servings), try JournalMeal(date: calendar.date(byAdding: .day, value: -1, to: today)!, food: dosa, quantity: 2, basis: .servings)]
        XCTAssertEqual(state.consumed(on: today, calendar: calendar), 345.0764465332031, accuracy: 0.000001)
    }
}
